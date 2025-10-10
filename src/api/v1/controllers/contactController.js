const Contact = require("../models/Contact");
const asyncHandler = require("express-async-handler");

exports.getContacts = asyncHandler(async (req, res) => {
  const contacts = await Contact.find({ user: req.user.id });
  res.status(200).json(contacts);
});

exports.addContact = asyncHandler(async (req, res) => {
  const { name, phoneNumber } = req.body;

  if (!name || !phoneNumber) {
    res.status(400);
    throw new Error("Nama dan nomor telepon tidak boleh kosong.");
  }

  const contact = new Contact({
    user: req.user.id,
    name,
    phoneNumber,
  });

  const createdContact = await contact.save();
  res.status(201).json(createdContact);
});

exports.deleteContact = asyncHandler(async (req, res) => {
  const contact = await Contact.findById(req.params.id);

  if (!contact) {
    res.status(404);
    throw new Error("Kontak tidak ditemukan.");
  }

  if (contact.user.toString() !== req.user.id) {
    res.status(401);
    throw new Error("Tidak diizinkan.");
  }

  await contact.deleteOne();

  res.status(200).json({ message: "Kontak berhasil dihapus." });
});
