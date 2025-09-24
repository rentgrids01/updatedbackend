const Contact = require('../models/Contact');

// Submit Contact Form (Public API - No Authentication Required)
const submitContactForm = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, message } = req.body;

    // Basic validation
    if (!firstName || !lastName || !email || !phone || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required: firstName, lastName, email, phone, message"
      });
    }

    // Extract client info for tracking (optional)
    const ipAddress = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 
                     (req.connection.socket ? req.connection.socket.remoteAddress : null);
    const userAgent = req.get('User-Agent');

    // Create contact submission
    const contactData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      message: message.trim(),
      ipAddress,
      userAgent
    };

    const contact = new Contact(contactData);
    await contact.save();

    // Return success response (don't expose internal database details)
    res.status(201).json({
      success: true,
      message: "Contact form submitted successfully! We'll get back to you soon.",
      data: {
        id: contact._id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        submittedAt: contact.createdAt
      }
    });

  } catch (error) {
    console.error('Contact form submission error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors
      });
    }

    // Handle duplicate submissions (if email is being tracked)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "A contact form with this email was recently submitted. Please wait before submitting again."
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: "Failed to submit contact form. Please try again later.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get Contact Form Submissions (Admin Only - For Future Use)
const getContactSubmissions = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status = 'all',
      search = '',
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};
    
    // Filter by status
    if (status !== 'all') {
      query.status = status;
    }

    // Search in name, email, or message
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const contacts = await Contact.find(query)
      .sort({ [sortBy]: order === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const totalContacts = await Contact.countDocuments(query);
    const totalPages = Math.ceil(totalContacts / limit);

    res.json({
      success: true,
      data: {
        contacts,
        pagination: {
          current: parseInt(page),
          total: totalPages,
          totalResults: totalContacts,
          hasNext: page < totalPages,
          hasPrev: page > 1,
          perPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve contact submissions",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update Contact Status (Admin Only - For Future Use)
const updateContactStatus = async (req, res) => {
  try {
    const { contactId } = req.params;
    const { status } = req.body;

    const validStatuses = ['new', 'read', 'responded', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const contact = await Contact.findByIdAndUpdate(
      contactId, 
      { status }, 
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({
        success: false,
        message: "Contact submission not found"
      });
    }

    res.json({
      success: true,
      message: "Contact status updated successfully",
      data: contact
    });

  } catch (error) {
    console.error('Update contact status error:', error);
    res.status(500).json({
      success: false,
      message: "Failed to update contact status",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  submitContactForm,
  getContactSubmissions,
  updateContactStatus
};