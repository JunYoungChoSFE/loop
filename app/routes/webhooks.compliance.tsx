import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import {
  collectCustomerData,
  purgeShop,
  redactCustomer,
} from "../models/gdpr.server";

/**
 * Handles all three mandatory GDPR compliance webhooks in one endpoint (App Store requirement).
 *  - customers/data_request: respond with retained data (logged here; actual delivery goes via the merchant).
 *  - customers/redact:      delete that customer's data.
 *  - shop/redact:           delete all of the shop's data.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);
  console.log(`Received compliance ${topic} webhook for ${shop}`);

  const body = payload as { customer?: { id?: number | string } };
  const customerId =
    body.customer?.id != null ? String(body.customer.id) : null;

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST": {
      if (customerId) {
        const data = await collectCustomerData(shop, customerId);
        // In production this data is delivered securely to the merchant. Here we only log whether any is retained.
        console.log(
          `data_request: customer ${customerId} retained data ${data ? "present" : "none"}`,
        );
      }
      break;
    }
    case "CUSTOMERS_REDACT": {
      if (customerId) await redactCustomer(shop, customerId);
      break;
    }
    case "SHOP_REDACT": {
      await purgeShop(shop);
      break;
    }
    default:
      console.log(`Unhandled compliance topic: ${topic}`);
  }

  return new Response();
};
