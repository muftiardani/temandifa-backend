const asyncHandler = require("express-async-handler");
const contactService = require("../services/contactService");

exports.getContacts = asyncHandler(async (req, res) => {
  const contacts = await contactService.getContactsForUser(req.user.id);
  res.status(200).json(contacts);
});

exports.addContact = asyncHandler(async (req, res) => {
  const createdContact = await contactService.addContact(req.user.id, req.body);
  res.status(201).json(createdContact);
});

exports.updateContact = asyncHandler(async (req, res) => {
  const updatedContact = await contactService.updateContact(
    req.params.id,
    req.user.id,
    req.body
  );
  res.status(200).json(updatedContact);
});

exports.deleteContact = asyncHandler(async (req, res) => {
  const result = await contactService.deleteContact(req.params.id, req.user.id);
  res.status(200).json(result);
});
