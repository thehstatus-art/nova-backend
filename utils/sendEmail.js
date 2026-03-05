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