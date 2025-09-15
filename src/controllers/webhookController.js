const crypto = require('crypto');
const WebhookEvent = require('../models/WebhookEvent');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const Invoice = require('../models/Invoice');
const UserSubscription = require('../models/UserSubscription');

// Razorpay Webhook Handler
const handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const body = JSON.stringify(req.body);

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(400).json({
        error: 'Invalid signature'
      });
    }

    const event = req.body;

    // Store webhook event
    const webhookEvent = await WebhookEvent.create({
      gateway: 'razorpay',
      eventType: event.event,
      eventId: event.payload?.payment?.entity?.id || event.payload?.order?.entity?.id,
      payload: event,
      signature
    });

    // Process event
    switch (event.event) {
      case 'payment.captured':
        await handlePaymentCaptured(event.payload.payment.entity);
        break;
      case 'payment.failed':
        await handlePaymentFailed(event.payload.payment.entity);
        break;
      case 'subscription.charged':
        await handleSubscriptionCharged(event.payload.subscription.entity);
        break;
      case 'subscription.cancelled':
        await handleSubscriptionCancelled(event.payload.subscription.entity);
        break;
      default:
        console.log(`Unhandled event type: ${event.event}`);
    }

    // Mark as processed
    webhookEvent.processed = true;
    await webhookEvent.save();

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({
      error: 'Webhook processing failed'
    });
  }
};

const handlePaymentCaptured = async (paymentEntity) => {
  try {
    const payment = await SubscriptionPayment.findOne({
      'meta.razorpay_order_id': paymentEntity.order_id
    });

    if (payment) {
      payment.status = 'captured';
      payment.gatewayPaymentId = paymentEntity.id;
      payment.updatedAt = new Date();
      await payment.save();

      // Update invoice
      const invoice = await Invoice.findById(payment.invoiceId);
      if (invoice) {
        invoice.status = 'paid';
        invoice.paidAt = new Date();
        await invoice.save();

        // Update subscription if needed
        if (invoice.subscriptionId) {
          const subscription = await UserSubscription.findById(invoice.subscriptionId);
          if (subscription && subscription.status === 'trialing') {
            subscription.status = 'active';
            subscription.updatedAt = new Date();
            await subscription.save();
          }
        }
      }
    }
  } catch (error) {
    console.error('Error handling payment captured:', error);
  }
};

const handlePaymentFailed = async (paymentEntity) => {
  try {
    const payment = await SubscriptionPayment.findOne({
      'meta.razorpay_order_id': paymentEntity.order_id
    });

    if (payment) {
      payment.status = 'failed';
      payment.failureReason = paymentEntity.error_description;
      payment.updatedAt = new Date();
      await payment.save();
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

const handleSubscriptionCharged = async (subscriptionEntity) => {
  // Handle recurring subscription charges
  console.log('Subscription charged:', subscriptionEntity.id);
};

const handleSubscriptionCancelled = async (subscriptionEntity) => {
  try {
    const subscription = await UserSubscription.findOne({
      gatewaySubscriptionId: subscriptionEntity.id
    });

    if (subscription) {
      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      subscription.updatedAt = new Date();
      await subscription.save();
    }
  } catch (error) {
    console.error('Error handling subscription cancelled:', error);
  }
};

module.exports = {
  handleRazorpayWebhook
};