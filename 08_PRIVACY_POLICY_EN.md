# 08 (EN) — Privacy Policy (English, for App Store listing)

> Public-facing privacy policy for the Roost app. Host this at the URL you submit as
> "Privacy policy URL" in your App Store listing.
> ⚠️ This is a starting draft, not legal advice. Have it reviewed before publishing.
> Values are filled in (operator, email, jurisdiction, sub-processors). Update the operator name to a
> registered business name if you incorporate, and adjust the effective date when you publish.

---

## Roost Privacy Policy

**Effective date:** June 8, 2026
**Operator:** Junyoung Cho ("Roost", "we", "us")

Roost is a loyalty app (points, rewards, and referrals) for small Shopify merchants. This policy explains what personal data Roost processes, why, and how.

### 1. Our role

The merchant is the **data controller**; Roost acts as a **data processor** on the merchant's behalf. We process customer personal data only as needed to let the merchant run their loyalty program through Roost.

### 2. Data we process (minimal collection)

**About a merchant's customers:**
- Email address
- Shopify customer ID
- Points balance and earn/redeem transaction history
- Order totals and purchase timestamps (used to award points and to estimate repurchase timing)
- Referral relationships (referrer / referee links)
- Derived prediction scores (e.g. estimated next-order date, churn-risk flag, lifetime-value estimate) — computed from the purchase history above

> We do **not** collect names, addresses, phone numbers, or payment/card details — they are unnecessary for running a loyalty program.

**About merchants:**
- Store domain, access token, and app settings (earn rate, widget color, etc.)

### 3. Purpose and legal basis

- Awarding points on purchases, redeeming points for discount codes, and granting referral rewards
- Estimating repurchase timing and churn risk to help the merchant retain customers (predictions). Any automatic action based on a prediction (a reminder email, bonus points, or a merchant alert) is **off by default** and runs only when the merchant explicitly enables it.
- Sending transactional emails about points/rewards (only when the merchant enables them)
- Legal basis: performance of our service contract with the merchant. We use the data **only for these purposes**. Prediction scores are derived data, deleted alongside the customer's other data on redaction/uninstall.

### 4. Sharing and sale

- We do **not sell** personal data.
- We do not share personal data with third parties for marketing.
- We use only the **sub-processors** necessary to operate the service:
  - Fly.io — application hosting and database
  - Tigris — encrypted database backup storage
  - Resend — email delivery (only when email notifications are enabled)
  - Shopify — platform

### 5. Retention and deletion

- We retain personal data only as long as needed to provide the loyalty service.
- When the app is **uninstalled, we completely remove** that merchant's data.
- We honor Shopify's GDPR compliance webhooks:
  - `customers/redact`: delete the specified customer's data
  - `shop/redact`: delete all of the merchant's data
  - `customers/data_request`: respond to data access requests

### 6. Security

- Encryption in transit (HTTPS) and at rest (managed database).
- Least-privilege access, strong authentication (2FA), and secure handling of secrets.
- We maintain a security incident response policy.

### 7. Data subject rights

Customers may request access to or deletion of their data through the merchant; we fulfill these via the GDPR webhooks above. We respect rights under applicable laws in the Republic of Korea (e.g., GDPR, CCPA).

### 8. International data transfers

Data may be processed in the region(s) where our hosting provider operates, with safeguards required by applicable law.

### 9. Changes

We may update this policy. We will update the effective date and post changes on this page.

### 10. Contact

Privacy inquiries: **liger4903@gmail.com**

---

_This draft does not constitute legal advice. Review before publishing._
