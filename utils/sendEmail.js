import nodemailer from "nodemailer";

/* ===============================
   EMAIL TRANSPORTER
================================ */

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD
  }
});

/* ===============================
   GENERIC EMAIL SENDER
================================ */

export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to,
      subject,
      html,
      text
    });

    console.log("📧 Email sent:", to);
  } catch (error) {
    console.error("❌ Email failed:", error);
  }
};

/* ===============================
   WELCOME EMAIL
================================ */

export const sendWelcomeEmail = async (email) => {
  return sendEmail({
    to: email,
    subject: "Welcome to Nova Peptide Labs",
    html: `
      <h2>Welcome to the Nova Research Network</h2>
      <p>You are now subscribed to Nova Peptide Labs updates.</p>
      <p>Visit the lab:</p>
      <a href="https://novapeptidelabs.org/shop">Explore Research Compounds</a>
    `
  });
};

/* ===============================
   ORDER CONFIRMATION
================================ */

export const sendOrderConfirmation = async (order, email) => {
  const items = order.items
    .map((item) => `${item.name} x ${item.quantity}`)
    .join("<br/>");

  return sendEmail({
    to: email,
    subject: "Nova Peptide Labs — Order Confirmation",
    html: `
      <h2>Order Confirmation</h2>
      <p>Order ID: ${order._id}</p>
      <p>Total: $${order.totalAmount}</p>
      <h3>Items</h3>
      <p>${items}</p>
    `
  });
};

/* ===============================
   ADMIN SALE ALERT
================================ */

export const sendAdminSaleAlert = async (order) => {
  return sendEmail({
    to: process.env.ZOHO_EMAIL,
    subject: `💰 New Sale - $${order.totalAmount}`,
    text: `New order received: ${order._id}`
  });
};

/* ===============================
   NEWSLETTER BLAST
================================ */

export const sendNewsletterBlast = async (emails, subject, contentHtml) => {
  if (!emails || emails.length === 0) return;

  try {
    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ZOHO_EMAIL,
      bcc: emails,
      subject,
      html: contentHtml
    });

    console.log("📢 Newsletter sent to subscribers");
  } catch (error) {
    console.error("❌ Newsletter failed:", error);
  }
};

/* ===============================
   BACKWARD COMPATIBILITY EXPORTS
   (used by existing routes)
================================ */

export const sendOrderConfirmationEmail = sendOrderConfirmation;
export const sendAdminOrderNotification = sendAdminSaleAlert;

export const sendAbandonedCheckoutEmail = async (email) => {
  return sendEmail({
    to: email,
    subject: "Nova Peptide Labs — Incomplete Checkout",
    html: `
      <h2>Your research order is waiting</h2>
      <p>You started a checkout but did not complete it.</p>
      <p>You can return to the lab anytime:</p>
      <a href="https://novapeptidelabs.org/shop">Return to Nova Lab</a>
    `
  });
};