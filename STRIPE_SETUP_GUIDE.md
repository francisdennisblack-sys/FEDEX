# Stripe Payment Setup Guide

This guide provides the final steps to enable live Stripe payments for your application.

Our backend is ready, but it needs your **private** Stripe API keys to process payments. You must add these keys yourself.

---

### Step 1: Get Your Stripe API Keys

You need two keys from your Stripe Dashboard: a **Secret Key** and a **Webhook Signing Secret**.

1.  **Find Your Secret Key:**
    *   Go to your [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys).
    *   Make sure you are in **Test mode**.
    *   On the API Keys page, you will see your **Secret key**. It starts with `sk_test_`.
    *   Keep this key safe.

2.  **Create a Webhook Endpoint and Get the Signing Secret:**
    *   While in Test mode, go to the [Webhooks page](https://dashboard.stripe.com/test/webhooks) in your Stripe Dashboard.
    *   Click **"Add an endpoint"**.
    *   For the **"Endpoint URL"**, you will eventually put your live function URL. For now, you can use a placeholder like `https://example.com/webhook`. We will use the Stripe CLI for local testing, which handles this for us.
    *   For **"Version"**, select the latest API version.
    *   For **"Events to send"**, click **"Select events"** and choose **`checkout.session.completed`**.
    *   Click **"Add endpoint"**.
    *   On the next page, under **"Signing secret"**, click **"Reveal"**.
    *   Your webhook signing secret will be displayed. It starts with `whsec_`.
    *   Keep this secret safe.

---

### Step 2: Set Your Stripe Keys for Firebase

Your Firebase Functions need to know these keys to work. You will set them as configuration variables.

*   **Open a new terminal in your VS Code editor.**
*   Navigate to your project folder:
    ```bash
    cd /Users/francisblack/Downloads/Fedex
    ```
*   Run the following commands, replacing `sk_test_...` and `whsec_...` with the actual keys you got from Stripe:

    ```bash
    # Replace with your actual Stripe secret key
    firebase functions:config:set stripe.secret="sk_test_..."

    # Replace with your actual webhook signing secret
    firebase functions:config:set stripe.webhook_secret="whsec_..."
    ```

    This securely stores your keys for both local emulators and live deployment.

---

### Step 3: Test Everything Locally

Before deploying, you can run everything on your machine to ensure it works.

1.  **Start the Firebase Emulators:**
    *   In your terminal (still in the `Fedex` folder), run:
        ```bash
        firebase emulators:start --only functions,database
        ```
    *   This will start a local version of your database and functions.

2.  **Forward Stripe Events to Your Local Emulator:**
    *   **Open a second terminal.**
    *   Run the Stripe CLI. You will need to replace `<YOUR_PROJECT_ID>` with your actual Firebase Project ID (e.g., `wificontent-143da`).
        ```bash
        stripe listen --forward-to http://localhost:5001/<YOUR_PROJECT_ID>/us-central1/handleStripeWebhook
        ```
    *   Keep this terminal running. It listens for events from Stripe and sends them to your local `handleStripeWebhook` function.

3.  **Trigger a Test Payment:**
    *   Go to your website in the browser and click the "Buy" or "Boost" button.
    *   Complete the test purchase using one of Stripe's [test cards](https://stripe.com/docs/testing#cards).
    *   When the payment succeeds, you should see the `checkout.session.completed` event in your `stripe listen` terminal.
    *   Check the Emulator UI's Database tab (at http://127.0.0.1:4000/database) to confirm that the `posts/{postId}` was updated correctly (`boostPaidAt` or `sellPaidAt` should be set).

---

### Step 4: Deploy to Production

Once you have confirmed everything works locally, you can deploy your functions to make them live.

*   In your terminal, run:
    ```bash
    firebase deploy --only functions
    ```

After deployment, your Stripe integration will be live and able to process real payments. Remember to switch your Stripe keys from **Test mode** to **Live mode** in the Stripe Dashboard and update your Firebase function configuration with the live keys when you are ready to accept real money.
