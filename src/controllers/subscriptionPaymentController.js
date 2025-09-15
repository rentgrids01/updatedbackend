const Invoice = require('../models/Invoice');
const SubscriptionPayment = require('../models/SubscriptionPayment');
const UserSubscription = require('../models/UserSubscription');
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Get User Invoices
const getUserInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.user._id };
    if (status) query.status = status;

    const invoices = await Invoice.find(query)
      .populate('subscriptionId', 'planId')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Invoice.countDocuments(query);

    res.json({
      data: {
        invoices,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(total / limit),
          hasNext: page * limit < total
        }
      },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: error.message
      }
    });
  }
};

// Get Invoice by ID
const getInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const invoice = await Invoice.findOne({
      _id: id,
      userId: req.user._id
    }).populate('subscriptionId');

    if (!invoice) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Invoice not found'
        }
      });
    }

    res.json({
      data: invoice,
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'FETCH_ERROR',
        message: error.message
      }
    });
  }
};

// Initialize Payment
const initializePayment = async (req, res) => {
  try {
    const { invoice_id, gateway = 'razorpay' } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoice_id,
      userId: req.user._id,
      status: 'pending'
    });

    if (!invoice) {
      return res.status(404).json({
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Pending invoice not found'
        }
      });
    }

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: invoice.total * 100, // Convert to paise
      currency: invoice.currency,
      receipt: invoice.invoiceNo,
      notes: {
        invoiceId: invoice._id.toString(),
        userId: req.user._id.toString()
      }
    });

    // Create payment record
    const payment = await SubscriptionPayment.create({
      invoiceId: invoice._id,
      userId: req.user._id,
      gateway,
      amount: invoice.total,
      currency: invoice.currency,
      meta: {
        razorpay_order_id: order.id
      }
    });

    res.json({
      data: {
        payment_id: payment._id,
        gateway_order_id: order.id,
        amount: invoice.total,
        currency: invoice.currency,
        invoice_no: invoice.invoiceNo
      },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'PAYMENT_INIT_ERROR',
        message: error.message
      }
    });
  }
};

// Confirm Payment
const confirmPayment = async (req, res) => {
  try {
    const { invoice_id, gateway, payload_from_gateway } = req.body;

    const invoice = await Invoice.findOne({
      _id: invoice_id,
      userId: req.user._id
    });

    if (!invoice) {
      return res.status(404).json({
        error: {
          code: 'INVOICE_NOT_FOUND',
          message: 'Invoice not found'
        }
      });
    }

    const payment = await SubscriptionPayment.findOne({
      invoiceId: invoice._id,
      status: 'created'
    });

    if (!payment) {
      return res.status(404).json({
        error: {
          code: 'PAYMENT_NOT_FOUND',
          message: 'Payment record not found'
        }
      });
    }

    if (gateway === 'razorpay') {
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = payload_from_gateway;

      // Verify signature
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        payment.status = 'failed';
        payment.failureReason = 'Invalid signature';
        await payment.save();

        return res.status(400).json({
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Payment verification failed'
          }
        });
      }

      // Update payment
      payment.status = 'captured';
      payment.gatewayPaymentId = razorpay_payment_id;
      payment.meta = {
        ...payment.meta,
        razorpay_payment_id,
        razorpay_signature
      };
      payment.updatedAt = new Date();
      await payment.save();

      // Update invoice
      invoice.status = 'paid';
      invoice.paidAt = new Date();
      await invoice.save();

      // Update subscription status if needed
      if (invoice.subscriptionId) {
        const subscription = await UserSubscription.findById(invoice.subscriptionId);
        if (subscription && subscription.status === 'trialing') {
          subscription.status = 'active';
          subscription.updatedAt = new Date();
          await subscription.save();
        }
      }
    }

    res.json({
      data: {
        payment_id: payment._id,
        status: payment.status,
        invoice: {
          id: invoice._id,
          status: invoice.status,
          paid_at: invoice.paidAt
        }
      },
      meta: { requestId: req.requestId }
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: 'PAYMENT_CONFIRM_ERROR',
        message: error.message
      }
    });
  }
};

module.exports = {
  getUserInvoices,
  getInvoiceById,
  initializePayment,
  confirmPayment
};