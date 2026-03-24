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
    pass: process.env.ZOHO_APP_PASSWORD,
  },
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
      text,
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
      <hr style="margin:25px 0"/>
      <p style="font-size:13px;color:#666">
      NovaPeptideLabs<br/>
      5504 13th Ave #1013<br/>
      Brooklyn, NY 11219<br/>
      United States
      </p>
    `,
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
      <hr style="margin:25px 0"/>
      <p style="font-size:13px;color:#666">
      NovaPeptideLabs<br/>
      5504 13th Ave #1013<br/>
      Brooklyn, NY 11219<br/>
      United States
      </p>
    `,
  });
};

/* ===============================
   ADMIN SALE ALERT
================================ */

export const sendAdminSaleAlert = async (order) => {
  const items = (order.items || [])
    .map((item) => `${item.name || "Research Compound"} x ${item.quantity || 1}`)
    .join("<br/>");

  const textItems = (order.items || [])
    .map((item) => `- ${item.name || "Research Compound"} x ${item.quantity || 1}`)
    .join("\n");

  return sendEmail({
    to: process.env.ZOHO_EMAIL,
    subject: `💰 New Sale - $${order.totalAmount}`,
    text: `New order received: ${order._id}\n${textItems}`,
    html: `
      <h2>New Sale Received</h2>
      <p>Order ID: ${order._id}</p>
      <p>Total: $${order.totalAmount}</p>
      <p>Email: ${order.email || order.customerEmail || "N/A"}</p>
      <h3>Items</h3>
      <p>${items || "No item details available"}</p>
      <hr style="margin:25px 0"/>
      <p style="font-size:13px;color:#666">
      NovaPeptideLabs<br/>
      5504 13th Ave #1013<br/>
      Brooklyn, NY 11219<br/>
      United States
      </p>
    `,
  });
};

/* ===============================
   BACK IN STOCK NEWSLETTER
================================ */

export const buildBackInStockNewsletter = ({
  subject = "Back In Stock: Full Inventory Has Been Restored",
  badge = "Full Restock Live",
  headline = "Everything is back in stock.",
  intro = "The wait is over. Full inventory has now been restored across the catalog, including Retatrutide, Tesamorelin, BPC-157, GHK-Cu, 5-Amino-1MQ, DSIP, and Glutathione. If you have been waiting to place your next order, now is the time to secure your items before top movers begin to sell through again.",
  featuredItems = [
    {
      name: "Retatrutide",
      url: "https://novapeptidelabs.org/product/retatrutide",
    },
    {
      name: "Tesamorelin",
      url: "https://novapeptidelabs.org/product/tesamorelin",
    },
    {
      name: "BPC-157",
      url: "https://novapeptidelabs.org/product/bpc-157",
    },
    {
      name: "GHK-Cu",
      url: "https://novapeptidelabs.org/product/ghk-cu",
    },
    {
      name: "5-Amino-1MQ",
      url: "https://novapeptidelabs.org/product/5-amino-1mq",
    },
    {
      name: "DSIP",
      url: "https://novapeptidelabs.org/product/dsip",
    },
    {
      name: "Glutathione",
      url: "https://novapeptidelabs.org/product/glutathione",
    },
  ],
  ctaLabel = "Shop Full Restock",
  shopUrl = "https://novapeptidelabs.org/shop",
} = {}) => {
  const safeItems = (
    Array.isArray(featuredItems) && featuredItems.length
      ? featuredItems
      : [
          { name: "Popular research compounds", url: shopUrl },
          { name: "Fresh batch releases", url: shopUrl },
        ]
  )
    .slice(0, 7)
    .map((item) => {
      if (typeof item === "string") {
        return { name: item, url: shopUrl };
      }

      return {
        name: item?.name || "Back in stock item",
        url: item?.url || shopUrl,
      };
    });

  const itemMarkup = safeItems
    .map(
      (item) => `
        <td style="padding:0 8px 16px 8px;" valign="top">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="border:1px solid #e7dcc9;border-radius:18px;padding:18px;background:#fffaf3;text-align:center;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:20px;color:#3f3428;">
                <p style="margin:0 0 12px 0;">${item.name}</p>
                <a href="${item.url}" style="display:inline-block;font-size:12px;letter-spacing:0.8px;text-transform:uppercase;color:#1f1a16;font-weight:bold;text-decoration:none;border-bottom:1px solid #cdb48c;padding-bottom:2px;">
                  View Item
                </a>
              </td>
            </tr>
          </table>
        </td>
      `
    )
    .join("");

  const text = `${headline}

${intro}

Featured now:
${safeItems.map((item) => `- ${item.name}: ${item.url}`).join("\n")}

Browse the catalog: ${shopUrl}

Nova Peptide Labs
5504 13th Ave #1013
Brooklyn, NY 11219
United States`;

  const html = `
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background:#f4efe8;">
        <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
          Select Nova inventory has been replenished. Shop the latest restock before it moves again.
        </div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:linear-gradient(180deg,#f4efe8 0%,#efe5d6 100%);">
          <tr>
            <td align="center" style="padding:32px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;max-width:640px;background:#fffdf9;border-radius:28px;overflow:hidden;box-shadow:0 18px 60px rgba(52,36,24,0.12);">
                <tr>
                  <td style="padding:18px 28px;background:#1d1a17;color:#f6eee2;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:2px;text-transform:uppercase;text-align:center;">
                    Nova Peptide Labs
                  </td>
                </tr>
                <tr>
                  <td style="padding:48px 40px 28px 40px;background:radial-gradient(circle at top left,#f2e4c8 0%,#f7f1e7 38%,#fffdf9 100%);">
                    <div style="margin-bottom:20px;">
                      <span style="display:inline-block;padding:8px 14px;border-radius:999px;background:#efe3cf;color:#7a5b2f;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.4px;text-transform:uppercase;font-weight:bold;">
                        ${badge}
                      </span>
                    </div>
                    <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:38px;line-height:44px;color:#241c15;font-weight:normal;">
                      ${headline}
                    </h1>
                    <p style="margin:0 0 28px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:27px;color:#5d5043;">
                      ${intro}
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:18px;">
                      <tr>
                        <td align="center" style="border-radius:999px;background:#201a15;">
                          <a href="${shopUrl}" style="display:inline-block;padding:15px 26px;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;letter-spacing:0.8px;text-transform:uppercase;color:#f8f2e9;text-decoration:none;">
                            ${ctaLabel}
                          </a>
                        </td>
                      </tr>
                    </table>
                    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;color:#8b7b69;">
                      Premium batches. Reliable turnaround. Limited restock availability.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 32px 8px 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        ${itemMarkup}
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 40px 40px 40px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                      <tr>
                        <td style="padding:24px;border-radius:22px;background:#f8f3ea;border:1px solid #eee2d1;">
                          <p style="margin:0 0 10px 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.3px;text-transform:uppercase;color:#8c7350;font-weight:bold;">
                            Why shop now
                          </p>
                          <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:25px;color:#514437;">
                            Restocked items can move quickly once the alert goes out. If something has been on your list, this is the cleanest time to revisit the catalog.
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:24px 40px 36px 40px;background:#f6efe5;border-top:1px solid #eadfce;">
                    <p style="margin:0 0 8px 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:22px;color:#6c5c4d;">
                      Nova Peptide Labs
                    </p>
                    <p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:20px;color:#8a7a69;">
                      5504 13th Ave #1013, Brooklyn, NY 11219, United States
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;

  return { subject, html, text };
};

/* ===============================
   NEWSLETTER BLAST
================================ */

export const sendNewsletterBlast = async (emails, subject, contentHtml) => {
  if (!emails || emails.length === 0) return false;

  try {
    await transporter.sendMail({
      from: `"Nova Peptide Labs" <${process.env.ZOHO_EMAIL}>`,
      to: process.env.ZOHO_EMAIL,
      bcc: emails,
      subject,
      html: contentHtml,
    });

    console.log("📢 Newsletter sent to subscribers");
    return true;
  } catch (error) {
    console.error("❌ Newsletter failed:", error);
    return false;
  }
};

/* ===============================
   BACKWARD COMPATIBILITY EXPORTS
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
    `,
  });
};
