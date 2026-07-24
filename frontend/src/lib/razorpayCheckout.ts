/** Load Razorpay Checkout.js and open subscription authorisation modal. */

type RazorpayInstance = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

function loadRazorpayScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay Checkout")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}

export async function openRazorpaySubscriptionCheckout(options: {
  keyId: string;
  subscriptionId: string;
  email?: string;
  name?: string;
  onSuccess?: () => void;
  onDismiss?: () => void;
}): Promise<void> {
  await loadRazorpayScript();
  if (!window.Razorpay) {
    throw new Error("Razorpay Checkout failed to initialize");
  }

  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: options.keyId,
      subscription_id: options.subscriptionId,
      name: "AKARA Insights",
      description: "Subscription upgrade",
      prefill: {
        email: options.email ?? "",
        name: options.name ?? "",
      },
      theme: { color: "#1565C0" },
      handler: () => {
        options.onSuccess?.();
        resolve();
      },
      modal: {
        ondismiss: () => {
          options.onDismiss?.();
          reject(new Error("Checkout closed"));
        },
      },
    });
    rzp.open();
  });
}
