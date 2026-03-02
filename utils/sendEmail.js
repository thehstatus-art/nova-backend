import nodemailer from 'nodemailer'

// 🔒 Create transporter once (not every email)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true, // required for 465
  auth: {
    user: process.env.ZOHO_EMAIL,
    pass: process.env.ZOHO_APP_PASSWORD
  }
})

/* ======================================
   CUSTOMER CONFIRMATION EMAIL
====================================== */

export const sendOrderConfirmation = async (order, toEmail) => {

  const itemsList = order.items.map(item =>
    `${item.name} x${item.quantity} - $${item.price}`
  ).join('\n')

  await transporter.sendMail({
    from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
    to: toEmail,
    subject: 'Nova Peptide Labs — Order Confirmation',
    text: `
Thank you for your order!

Order ID: ${order._id}
Total: $${order.totalAmount}

Items:
${itemsList}

We appreciate your business.

Nova Peptide Labs
`
  })

  console.log('📧 Confirmation email sent to:', toEmail)
}

/* ======================================
   ADMIN SALE ALERT EMAIL
====================================== */

export const sendAdminSaleAlert = async (order) => {

  await transporter.sendMail({
    from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
    to: process.env.ZOHO_EMAIL, // sends to your support inbox
    subject: `💰 New Sale - $${order.totalAmount}`,
    text: `
🚀 New Order Received

Order ID: ${order._id}
Total: $${order.totalAmount}
Time: ${new Date().toISOString()}

Check admin dashboard for details.
`
  })

  console.log('📧 Admin sale alert sent')
}