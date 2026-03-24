import mongoose from "mongoose";
import Subscriber from "../models/Subscriber.js";

const LEGACY_COLLECTIONS = [
  "subscribers",
  "subscriber",
  "emails",
  "emailsubscribers",
  "newslettersubscribers",
];

const normalizeEmail = (email = "") => String(email).trim().toLowerCase();

export const loadAllSubscribers = async () => {
  const deduped = new Map();

  const primarySubscribers = await Subscriber.find().lean();

  for (const sub of primarySubscribers) {
    const email = normalizeEmail(sub.email);
    if (!email) continue;

    deduped.set(email, {
      ...sub,
      email,
    });
  }

  // If the primary model is empty, try a few likely legacy collection names.
  if (deduped.size === 0) {
    for (const collectionName of LEGACY_COLLECTIONS) {
      try {
        const exists = await mongoose.connection.db
          .listCollections({ name: collectionName })
          .hasNext();

        if (!exists) continue;

        const docs = await mongoose.connection.db
          .collection(collectionName)
          .find({})
          .toArray();

        for (const doc of docs) {
          const email = normalizeEmail(doc.email);
          if (!email) continue;

          deduped.set(email, {
            ...doc,
            email,
          });
        }
      } catch (err) {
        console.error(`Legacy subscriber lookup failed for ${collectionName}:`, err);
      }
    }
  }

  return Array.from(deduped.values());
};

export const countAllSubscribers = async () => {
  const subscribers = await loadAllSubscribers();
  return subscribers.length;
};
