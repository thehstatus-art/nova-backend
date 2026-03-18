

import fetch from "node-fetch";

const SHIPPO_API = "https://api.goshippo.com";

export const createShippoLabel = async (order) => {
  try {

    const shipmentRes = await fetch(`${SHIPPO_API}/shipments/`, {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        address_from: {
          name: "NovaPeptideLabs",
          street1: "5504 13th Ave #1013",
          city: "Brooklyn",
          state: "NY",
          zip: "11219",
          country: "US",
        },
        address_to: {
          name: order.shippingAddress?.name,
          street1: order.shippingAddress?.street,
          city: order.shippingAddress?.city,
          state: order.shippingAddress?.state,
          zip: order.shippingAddress?.zip,
          country: "US",
        },
        parcels: [
          {
            length: "6",
            width: "4",
            height: "2",
            distance_unit: "in",
            weight: "0.5",
            mass_unit: "lb",
          },
        ],
        async: false,
      }),
    });

    const shipment = await shipmentRes.json();

    if (!shipment || !shipment.rates || shipment.rates.length === 0) {
      throw new Error("No shipping rates returned from Shippo");
    }

    const rate = shipment.rates[0];

    const transactionRes = await fetch(`${SHIPPO_API}/transactions/`, {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${process.env.SHIPPO_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rate: rate.object_id,
        label_file_type: "PDF",
      }),
    });

    const transaction = await transactionRes.json();

    if (transaction.status !== "SUCCESS") {
      throw new Error("Shippo label creation failed");
    }

    return transaction.label_url;

  } catch (error) {
    console.error("Shippo label error:", error);
    return null;
  }
};