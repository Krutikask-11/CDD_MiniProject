// Shared constants and small validation helpers.
const CATEGORIES = ['Water supply', 'Wi-Fi', 'Electricity', 'Mess', 'Cleanliness', 'Other'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];
const MAX_PHOTO_CHARS = 2 * 1024 * 1024; // roughly 2 MB

// true only for a non-empty string (also blocks NoSQL injection like {"$ne": null})
const isText = (v) => typeof v === 'string' && v.trim().length > 0;
// reject HTML-looking input; the frontend also escapes output
const hasUnsafeChars = (v) => /[<>]/.test(v);
const isEmail = (v) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

module.exports = { CATEGORIES, STATUSES, MAX_PHOTO_CHARS, isText, hasUnsafeChars, isEmail };
