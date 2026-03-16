import nodemailer from "nodemailer"
import Order from "../models/Order.js"

/* ===============================
   CREATE EMAIL TRANSPORTER
================================ */

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD
  }
})

// Generic email sender used by routes like newsletterRoutes
export const sendEmail = async ({ to, subject, html, text }) => {
  try {
    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to,
      subject,
      html,
      text
    });

    console.log("📧 Generic email sent:", to);
  } catch (error) {
    console.error("❌ Generic email failed:", error);
  }
};
/* ===============================
   WELCOME EMAIL (EMAIL SIGNUP)
================================ */

export const sendWelcomeEmail = async (email) => {
  try {

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: "Welcome to Nova Peptide Labs",

      html: `

<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;background:#081523;color:#ffffff;padding:30px;border-radius:10px">

  <div style="text-align:center;margin-bottom:20px">
    <img src="https://novapeptidelabs.org/logo.png" alt="Nova Peptide Labs" style="width:180px" />
  </div>

  <h2 style="color:#6ec1ff;text-align:center">Welcome to the Nova Research Network</h2>

  <p style="text-align:center">
  You are now part of the Nova Peptide Labs research community.
  Stay updated on new compound releases, limited lab batches, and restock alerts.
  </p>

  <div style="text-align:center;margin:30px 0">
    <a href="https://novapeptidelabs.org/shop"
       style="background:#6ec1ff;color:#081523;padding:14px 26px;text-decoration:none;border-radius:6px;font-weight:bold">
       Explore Research Compounds
    </a>
  </div>

  <h3 style="color:#6ec1ff;margin-top:30px">Current Research Compounds</h3>

  <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:15px">

    <div style="text-align:center;width:120px">
      <img src="https://novapeptidelabs.org/images/retatrutide.jpg" width="100" />
      <p style="font-size:12px">Retatrutide</p>
    </div>

    <div style="text-align:center;width:120px">
      <img src="https://novapeptidelabs.org/images/tesamorelin.jpg" width="100" />
      <p style="font-size:12px">Tesamorelin</p>
    </div>

    <div style="text-align:center;width:120px">
      <img src="https://novapeptidelabs.org/images/ghkcu.jpg" width="100" />
      <p style="font-size:12px">GHK-Cu</p>
    </div>

    <div style="text-align:center;width:120px">
      <img src="https://novapeptidelabs.org/images/bpc157.jpg" width="100" />
      <p style="font-size:12px">BPC‑157</p>
    </div>

  </div>

  <p style="margin-top:30px;font-size:13px;color:#9bb3c9">
  Nova Peptide Labs provides laboratory research compounds intended strictly for
  scientific investigation. Products are not approved for human consumption.
  </p>

  <hr style="border:0;border-top:1px solid rgba(255,255,255,0.1)" />

  <p style="font-size:12px;color:#7a8fa6;text-align:center">
  Nova Peptide Labs<br/>
  Research Compounds for Laboratory Use Only
  </p>

</div>

      `
    })

    console.log("📧 Welcome email sent:", email)

  } catch (error) {
    console.error("❌ Welcome email failed:", error)
  }
}
/* ===============================
   CUSTOMER ORDER CONFIRMATION
================================ */

export const sendOrderConfirmation = async (order, toEmail) => {
  try {

    const itemsList = order.items
      .map(item => {
        const subtotal = item.price * item.quantity
        return `
      <tr>
        <td style="padding:8px 0">${item.name}</td>
        <td style="padding:8px 0;text-align:center">${item.quantity}</td>
        <td style="padding:8px 0;text-align:right">$${subtotal}</td>
      </tr>
    `
      })
      .join("")

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: toEmail,
      subject: "Nova Peptide Labs — Order Confirmation",

      html: `

<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;background:#081523;color:#ffffff;padding:30px;border-radius:10px">

  <div style="text-align:center;margin-bottom:20px">
    <img src="https://novapeptidelabs.org/logo.png" style="width:180px" />
  </div>

  <h2 style="color:#6ec1ff;text-align:center">Order Confirmation</h2>

  <p style="text-align:center">
  Your research order has been received and is now being processed.
  </p>

  <div style="margin-top:20px;background:#0f2236;padding:15px;border-radius:6px">

    <p><strong>Order ID:</strong> ${order._id}</p>
    <p><strong>Total:</strong> $${order.totalAmount}</p>

  </div>

  <h3 style="margin-top:25px;color:#6ec1ff">Items Purchased</h3>

  <table style="width:100%;border-collapse:collapse;margin-top:10px">
    <thead>
      <tr style="border-bottom:1px solid rgba(255,255,255,0.1)">
        <th style="text-align:left;padding:6px 0">Compound</th>
        <th style="text-align:center;padding:6px 0">Qty</th>
        <th style="text-align:right;padding:6px 0">Subtotal</th>
      </tr>
    </thead>

    <tbody>
      ${itemsList}
    </tbody>

  </table>

  <p style="margin-top:25px">
  You will receive another email once your order ships with tracking information.
  </p>

  <div style="text-align:center;margin:30px 0">
    <a href="https://novapeptidelabs.org/shop"
       style="background:#6ec1ff;color:#081523;padding:14px 26px;text-decoration:none;border-radius:6px;font-weight:bold">
       Visit Nova Peptide Labs
    </a>
  </div>

  <hr style="border:0;border-top:1px solid rgba(255,255,255,0.1)" />

  <p style="font-size:12px;color:#7a8fa6;text-align:center">
  Nova Peptide Labs — Research Compounds for Laboratory Use Only
  </p>

</div>

`
    })

    console.log("📧 Confirmation email sent to:", toEmail)

  } catch (error) {
    console.error("❌ Email confirmation failed:", error)
  }
}

// Alias used by order routes
export const sendOrderConfirmationEmail = async (email, order) => {
  return sendOrderConfirmation(order, email)
}

/* ===============================
   ADMIN SALE ALERT
================================ */

export const sendAdminSaleAlert = async (order) => {
  try {

    const itemsList = order.items
      .map(item => {
        const subtotal = item.price * item.quantity
        return `• ${item.name} × ${item.quantity} — $${subtotal}`
      })
      .join("\n")

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ZOHO_EMAIL,
      subject: `💰 New Sale - $${order.totalAmount}`,

      text: `
🚨 NEW ORDER RECEIVED

Order ID: ${order._id}
Customer Email: ${order.customerEmail || order.email}

Items:
${itemsList}

Total: $${order.totalAmount}

Login to admin dashboard to print shipping label.
`
    })

    console.log("📧 Admin sale alert sent")

  } catch (error) {
    console.error("❌ Admin alert failed:", error)
  }
}

// Alias used by order routes
export const sendAdminOrderNotification = async (order) => {
  return sendAdminSaleAlert(order)
}

/* ===============================
   SHIPPING TRACKING EMAIL
================================ */

export const sendTrackingEmail = async (order) => {
  try {

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: order.customerEmail || order.email,
      subject: "📦 Your Order Has Shipped",

      html: `
      <h2>Your Order Has Shipped</h2>

      <p>Your order is on the way.</p>

      <p><strong>Tracking Number:</strong></p>
      <p>${order.trackingNumber}</p>

      <p>
      Track your shipment here:
      </p>

      <a href="${order.shippingLabelUrl}">
      Track Package
      </a>

      <hr/>

      <p>
      Thank you for choosing Nova Peptide Labs.
      </p>
      `
    })

    console.log("📦 Tracking email sent")

  } catch (error) {
    console.error("❌ Tracking email failed:", error)
  }
}

/* ===============================
   LOW STOCK ALERT
================================ */

export const sendAdminLowStockAlert = async (product) => {
  try {

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ZOHO_EMAIL,
      subject: `⚠ LOW STOCK ALERT - ${product.name}`,

      text: `
Product: ${product.name}
Remaining Stock: ${product.stock}

Please restock immediately.

`
    })

    console.log("⚠ Low stock alert sent")

  } catch (error) {
    console.error("❌ Low stock alert failed:", error)
  }
}
/* ===============================
   ABANDONED CHECKOUT EMAIL
================================ */

export const sendAbandonedCheckoutEmail = async (email, stage = 1) => {
  try {

    // Prevent sending abandoned email if customer already completed an order
    const latestOrder = await Order.findOne({ email }).sort({ createdAt: -1 });

    if (latestOrder && (latestOrder.isPaid || latestOrder.status === "paid")) {
      console.log("⛔ Abandoned email cancelled — order already paid:", email);
      return;
    }

    let subject = "Complete your research order";
    let message = "";

    if (stage === 1) {
      message = `
      <p>You started checkout but didn’t complete your order.</p>
      <p>Your research compounds are still available.</p>
      `;
    }

    if (stage === 2) {
      message = `
      <p>Your checkout session is still open.</p>
      <p>Complete your order before inventory runs out.</p>
      `;
    }

    if (stage === 3) {
      message = `
      <p>Your research cart is still waiting.</p>
      <p><strong>Use code COMPLETE10 for 10% off your order.</strong></p>
      `;
    }

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: email,
      subject: subject,
      html: `
<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:auto;padding:20px;background:#0b1724;color:#ffffff;border-radius:8px">

  <h2 style="color:#6ec1ff">${subject}</h2>

  ${message}

  <p style="margin-top:20px">
  Your selected research compounds are still reserved temporarily.
  Complete your order before stock becomes unavailable.
  </p>

  <div style="text-align:center;margin:30px 0">
    <a href="https://novapeptidelabs.org/shop"
       style="background:#6ec1ff;color:#081523;padding:14px 26px;text-decoration:none;border-radius:6px;font-weight:bold">
       Resume Checkout
    </a>
  </div>

  <p style="font-size:13px;color:#9bb3c9">
  Nova Peptide Labs provides laboratory research compounds intended strictly for
  scientific investigation. Products are not approved for human consumption.
  </p>

  <hr style="border:0;border-top:1px solid rgba(255,255,255,0.1)" />

  <p style="font-size:12px;color:#7a8fa6">
  Nova Peptide Labs<br/>
  Research Compounds for Laboratory Use Only
  </p>

</div>
`
    });

    console.log("📧 Abandoned checkout email sent:", email);

  } catch (error) {
    console.error("❌ Abandoned checkout email failed:", error);
  }
};

/* ===============================
   NEWSLETTER BROADCAST EMAIL
================================ */

export const sendNewsletterBlast = async (emails, subject, contentHtml) => {
  try {

    if (!emails || emails.length === 0) {
      console.log("No subscribers found for newsletter.")
      return
    }

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,

      // send to yourself but BCC all subscribers
      to: process.env.ZOHO_EMAIL,
      bcc: emails,

      subject: subject,

      html: `

<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:auto;background:#081523;color:#ffffff;padding:30px;border-radius:10px">

  <div style="text-align:center;margin-bottom:20px">
    <img src="https://novapeptidelabs.org/logo.png" style="width:180px" />
  </div>

  <h2 style="color:#6ec1ff;text-align:center">Nova Research Network Update</h2>

  <div style="margin-top:20px;font-size:15px;line-height:1.6">
    ${contentHtml}
  </div>

  <div style="text-align:center;margin:30px 0">
    <a href="https://novapeptidelabs.org/shop"
       style="background:#6ec1ff;color:#081523;padding:14px 26px;text-decoration:none;border-radius:6px;font-weight:bold">
       Visit Nova Peptide Labs
    </a>
  </div>

  <hr style="border:0;border-top:1px solid rgba(255,255,255,0.1)" />

  <p style="font-size:12px;color:#7a8fa6;text-align:center">
  Nova Peptide Labs — Research Compounds for Laboratory Use Only
  </p>

</div>

      `
    })

    console.log("📢 Newsletter sent to subscribers")

  } catch (error) {
    console.error("❌ Newsletter send failed:", error)
  }
}