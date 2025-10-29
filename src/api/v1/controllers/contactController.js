const asyncHandler = require("express-async-handler");
const contactService = require("../services/contactService");
const { logWithContext, errorWithContext } = require("../../../config/logger");

exports.getContacts = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  logWithContext("info", "Fetching contacts for user", req);

  const contacts = await contactService.getContactsForUser(userId, req);

  const logLevel = process.env.NODE_ENV === "production" ? "info" : "debug";
  logWithContext(logLevel, `Found ${contacts.length} contacts for user`, req);

  res.status(200).json(contacts);
});

exports.addContact = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { name, phoneNumber } = req.body;

  logWithContext("info", "Adding new contact attempt", req, {
    contactName: name,
  });

  if (!name || !phoneNumber) {
    res.status(400);
    throw new Error("Nama dan nomor telepon wajib diisi");
  }

  const createdContact = await contactService.addContact(userId, req.body, req);

  logWithContext(
    "info",
    `Contact added successfully: ${createdContact._id}`,
    req
  );

  res.status(201).json(createdContact);
});

exports.updateContact = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const contactId = req.params.id;
  const { name, phoneNumber } = req.body;

  logWithContext("info", `Updating contact attempt: ${contactId}`, req, {
    contactName: name,
  });

  if (!name && !phoneNumber) {
    res.status(400);
    throw new Error(
      "Setidaknya nama atau nomor telepon harus diisi untuk update"
    );
  }

  const updatedContact = await contactService.updateContact(
    contactId,
    userId,
    req.body,
    req
  );

  logWithContext(
    "info",
    `Contact updated successfully: ${updatedContact._id}`,
    req
  );

  res.status(200).json(updatedContact);
});

exports.deleteContact = asyncHandler(async (req, res, next) => {
  const userId = req.user.id;
  const contactId = req.params.id;

  logWithContext("info", `Deleting contact attempt: ${contactId}`, req);

  const result = await contactService.deleteContact(contactId, userId, req);

  logWithContext("info", `Contact deleted successfully: ${contactId}`, req);

  res.status(200).json({ message: "Kontak berhasil dihapus" });
});
