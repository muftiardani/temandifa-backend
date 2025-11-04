const Contact = require("../models/Contact");
const { logWithContext, errorWithContext } = require("../../../config/logger");
const { redisClient } = require("../../../config/redis");

const getContactsCacheKey = (userId) => `contacts:${userId}`;
const CONTACTS_CACHE_TTL = 86400;

const getContactsForUser = async (userId, req = null) => {
  logWithContext("debug", `Fetching contacts for user ${userId}`, req);

  const cacheKey = getContactsCacheKey(userId);
  try {
    const cachedContacts = await redisClient.get(cacheKey);
    if (cachedContacts) {
      logWithContext(
        "debug",
        `Contacts list for user ${userId} found in CACHE`,
        req
      );
      return JSON.parse(cachedContacts);
    }
  } catch (cacheError) {
    errorWithContext("Redis GET error for contacts", cacheError, req);
  }

  try {
    const contacts = await Contact.find({ user: userId })
      .sort({ name: 1 })
      .lean();

    logWithContext(
      "debug",
      `Found ${contacts.length} contacts for user ${userId} from DB`,
      req
    );

    try {
      redisClient.set(cacheKey, JSON.stringify(contacts), {
        EX: CONTACTS_CACHE_TTL,
      });
    } catch (cacheError) {
      errorWithContext("Redis SET error for contacts", cacheError, req);
    }

    return contacts;
  } catch (error) {
    errorWithContext(
      `Database error fetching contacts for user ${userId}`,
      error,
      req
    );
    throw new Error("Gagal mengambil daftar kontak.");
  }
};

const addContact = async (userId, contactData, req = null) => {
  const { name, phoneNumber } = contactData;
  logWithContext("info", `Attempting to add contact for user ${userId}`, req, {
    contactName: name,
  });

  if (!name || !phoneNumber) {
    const error = new Error("Nama dan nomor telepon tidak boleh kosong.");
    error.statusCode = 400;
    throw error;
  }

  try {
    const contact = new Contact({
      user: userId,
      name,
      phoneNumber,
    });
    const savedContact = await contact.save();

    try {
      await redisClient.del(getContactsCacheKey(userId));
    } catch (cacheError) {
      errorWithContext("Redis DEL error after adding contact", cacheError, req);
    }

    logWithContext(
      "info",
      `Contact added successfully for user ${userId}: ${savedContact._id}`,
      req
    );
    return savedContact;
  } catch (error) {
    errorWithContext(`Error adding contact for user ${userId}`, error, req);
    if (error.name === "ValidationError") {
      const validationError = new Error(
        `Data kontak tidak valid: ${error.message}`
      );
      validationError.statusCode = 400;
      throw validationError;
    }
    if (error.code === 11000) {
      const duplicateError = new Error("Kontak dengan detail ini sudah ada.");
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    throw new Error("Gagal menambahkan kontak ke database.");
  }
};

const updateContact = async (contactId, userId, updateData, req = null) => {
  logWithContext(
    "info",
    `Attempting to update contact ${contactId} for user ${userId}`,
    req
  );

  if (!updateData || (!updateData.name && !updateData.phoneNumber)) {
    const error = new Error(
      "Setidaknya nama atau nomor telepon harus disediakan untuk pembaruan."
    );
    error.statusCode = 400;
    throw error;
  }

  try {
    const contact = await Contact.findOne({ _id: contactId, user: userId });

    if (!contact) {
      logWithContext(
        "warn",
        `Contact not found or user ${userId} not authorized to update contact ${contactId}`,
        req
      );
      const error = new Error(
        "Kontak tidak ditemukan atau Anda tidak berhak mengubahnya."
      );
      error.statusCode = 404;
      throw error;
    }

    if (updateData.name) {
      contact.name = updateData.name;
    }
    if (updateData.phoneNumber) {
      contact.phoneNumber = updateData.phoneNumber;
    }

    const updatedContact = await contact.save();

    try {
      await redisClient.del(getContactsCacheKey(userId));
    } catch (cacheError) {
      errorWithContext(
        "Redis DEL error after updating contact",
        cacheError,
        req
      );
    }

    logWithContext(
      "info",
      `Contact ${contactId} updated successfully by user ${userId}`,
      req
    );
    return updatedContact;
  } catch (error) {
    errorWithContext(
      `Error updating contact ${contactId} for user ${userId}`,
      error,
      req
    );
    if (error.name === "ValidationError") {
      const validationError = new Error(
        `Data kontak tidak valid: ${error.message}`
      );
      validationError.statusCode = 400;
      throw validationError;
    }
    if (error.code === 11000) {
      const duplicateError = new Error(
        "Kontak dengan nomor telepon ini sudah ada."
      );
      duplicateError.statusCode = 409;
      throw duplicateError;
    }
    if (
      error.statusCode === 404 ||
      error.statusCode === 403 ||
      error.statusCode === 400
    ) {
      throw error;
    }
    throw new Error("Gagal memperbarui kontak di database.");
  }
};

const deleteContact = async (contactId, userId, req = null) => {
  logWithContext(
    "info",
    `Attempting to delete contact ${contactId} for user ${userId}`,
    req
  );

  try {
    const contact = await Contact.findOne({ _id: contactId, user: userId });

    if (!contact) {
      logWithContext(
        "warn",
        `Contact not found or user ${userId} not authorized to delete contact ${contactId}`,
        req
      );
      const error = new Error(
        "Kontak tidak ditemukan atau Anda tidak berhak menghapusnya."
      );
      error.statusCode = 404;
      throw error;
    }

    await contact.deleteOne();

    try {
      await redisClient.del(getContactsCacheKey(userId));
    } catch (cacheError) {
      errorWithContext(
        "Redis DEL error after deleting contact",
        cacheError,
        req
      );
    }

    logWithContext(
      "info",
      `Contact ${contactId} deleted successfully by user ${userId}`,
      req
    );
    return { message: "Kontak berhasil dihapus." };
  } catch (error) {
    errorWithContext(
      `Error deleting contact ${contactId} for user ${userId}`,
      error,
      req
    );
    if (error.statusCode === 404 || error.statusCode === 403) {
      throw error;
    }
    throw new Error("Gagal menghapus kontak dari database.");
  }
};

const getContactById = async (userId, contactId, req = null) => {
  logWithContext(
    "debug",
    `Fetching contact by ID ${contactId} for user ${userId}`,
    req
  );
  try {
    const contact = await Contact.findOne({
      _id: contactId,
      user: userId,
    }).lean();
    if (!contact) {
      logWithContext(
        "warn",
        `Contact not found or user ${userId} not authorized for contact ${contactId}`,
        req
      );
      const error = new Error(
        "Kontak tidak ditemukan atau Anda tidak berhak melihatnya."
      );
      error.statusCode = 404;
      throw error;
    }
    logWithContext(
      "debug",
      `Contact ${contactId} found for user ${userId}`,
      req
    );
    return contact;
  } catch (error) {
    errorWithContext(
      `Error fetching contact by ID ${contactId} for user ${userId}`,
      error,
      req
    );
    if (error.statusCode === 404) {
      throw error;
    }
    if (error.name === "CastError") {
      const castError = new Error("ID Kontak tidak valid.");
      castError.statusCode = 400;
      throw castError;
    }
    throw new Error("Gagal mengambil detail kontak.");
  }
};

module.exports = {
  getContactsForUser,
  addContact,
  updateContact,
  deleteContact,
  getContactById,
};
