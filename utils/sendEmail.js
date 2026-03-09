import nodemailer from "nodemailer"


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
      <h2>Welcome to Nova Peptide Labs</h2>

      <p>
      Thank you for joining our research community.
      </p>

      <p>
      Nova Peptide Labs provides pharmaceutical-grade research compounds
      manufactured under strict laboratory standards.
      </p>

      <p>
      Explore our available compounds below:
      </p>

      <a href="https://novapeptidelabs.org/shop">
      Browse Research Compounds
      </a>

      <hr/>

      <p>
      Nova Peptide Labs<br/>
      Research Compounds for Laboratory Use Only
      </p>
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
      .map(item => `<li>${item.name} × ${item.quantity} — $${item.price}</li>`)
      .join("")

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: toEmail,
      subject: "Nova Peptide Labs — Order Confirmation",

      html: `
      <h2>Thank you for your order</h2>

      <p>Your order has been received and is now being processed.</p>

      <h3>Order Details</h3>

      <p><strong>Order ID:</strong> ${order._id}</p>
      <p><strong>Total:</strong> $${order.totalAmount}</p>

      <ul>
        ${itemsList}
      </ul>

      <p>
      You will receive another email when your order ships.
      </p>

      <hr/>

      <p>
      Nova Peptide Labs<br/>
      Research Compounds for Laboratory Use Only
      </p>
      `
    })

    console.log("📧 Confirmation email sent to:", toEmail)

  } catch (error) {
    console.error("❌ Email confirmation failed:", error)
  }
}

/* ===============================
   ADMIN SALE ALERT
================================ */

export const sendAdminSaleAlert = async (order) => {
  try {

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ZOHO_EMAIL,
      subject: `💰 New Sale - $${order.totalAmount}`,

      text: `
New Order Received 🚀

Order ID: ${order._id}
Total: $${order.totalAmount}
Customer: ${order.customerEmail}
`
    })

    console.log("📧 Admin sale alert sent")

  } catch (error) {
    console.error("❌ Admin alert failed:", error)
  }
}

/* ===============================
   SHIPPING TRACKING EMAIL
================================ */

export const sendTrackingEmail = async (order) => {
  try {

    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: order.customerEmail,
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
      <h2>${subject}</h2>

      ${message}

      <a href="https://novapeptidelabs.org/shop">
      Return to Checkout
      </a>

      <hr/>

      <p>
      Nova Peptide Labs<br/>
      Research Compounds for Laboratory Use Only
      </p>
      `
    });

    console.log("📧 Abandoned checkout email sent:", email);

  } catch (error) {
    console.error("❌ Abandoned checkout email failed:", error);
  }
};