const express = require("express");
const router = express.Router();
const Stripe = require("stripe");


console.log("Stripe key length:", process.env.STRIPE_SECRET_KEY?.length);
console.log("Stripe key raw:", JSON.stringify(process.env.STRIPE_SECRET_KEY));
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

router.post("/create-checkout-session", async (req, res) => {
  try {
    const { cartItems } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: cartItems.map(item => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: item.name,
          },
          unit_amount: item.price * 100,
        },
        quantity: item.quantity,
      })),
      mode: "payment",
      success_url: "https://novapeptidelabs.org/success",
      cancel_url: "https://novapeptidelabs.org/cancel",
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Stripe session creation failed" });
  }
});

module.exports = router;
