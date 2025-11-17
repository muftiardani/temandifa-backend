const mongoose = require("mongoose");

const contactSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Nama kontak tidak boleh kosong."],
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: [true, "Nomor telepon tidak boleh kosong."],
      trim: true,
    },
  },
  { timestamps: true }
);

contactSchema.index({ user: 1, phoneNumber: 1 }, { unique: true });

const Contact = mongoose.model("Contact", contactSchema);
module.exports = Contact;
