const Contact = require("../models/Contact");

/**
 * Mendapatkan semua kontak untuk pengguna tertentu.
 */
const getContactsForUser = async (userId) => {
  return await Contact.find({ user: userId });
};

/**
 * Menambahkan kontak baru untuk pengguna.
 */
const addContact = async (userId, contactData) => {
  const { name, phoneNumber } = contactData;

  if (!name || !phoneNumber) {
    const error = new Error("Nama dan nomor telepon tidak boleh kosong.");
    error.status = 400;
    throw error;
  }

  const contact = new Contact({
    user: userId,
    name,
    phoneNumber,
  });

  return await contact.save();
};

/**
 * Memperbarui kontak yang ada.
 */
const updateContact = async (contactId, userId, updateData) => {
  const contact = await Contact.findById(contactId);

  if (!contact) {
    const error = new Error("Kontak tidak ditemukan.");
    error.status = 404;
    throw error;
  }

  if (contact.user.toString() !== userId) {
    const error = new Error("Tidak diizinkan untuk memperbarui kontak ini.");
    error.status = 403;
    throw error;
  }

  contact.name = updateData.name || contact.name;
  contact.phoneNumber = updateData.phoneNumber || contact.phoneNumber;

  return await contact.save();
};

/**
 * Menghapus kontak.
 */
const deleteContact = async (contactId, userId) => {
  const contact = await Contact.findById(contactId);

  if (!contact) {
    const error = new Error("Kontak tidak ditemukan.");
    error.status = 404;
    throw error;
  }

  if (contact.user.toString() !== userId) {
    const error = new Error("Tidak diizinkan untuk menghapus kontak ini.");
    error.status = 403;
    throw error;
  }

  await contact.deleteOne();
  return { message: "Kontak berhasil dihapus." };
};

module.exports = {
  getContactsForUser,
  addContact,
  updateContact,
  deleteContact,
};
