const nodemailer = require('nodemailer');
const EmailOTP = require('../models/EmailOTP');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTPEmail = async (email, purpose = 'verification') => {
  try {
    const otp = generateOTP();

    // Save OTP to database
    await EmailOTP.create({
      email,
      otp,
      purpose
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: purpose === 'verification' ? 'Email Verification - RentGrid' : 'Password Reset - RentGrid',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>RentGrid ${purpose === 'verification' ? 'Email Verification' : 'Password Reset'}</h2>
          <p>Your OTP is: <strong>${otp}</strong></p>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

const verifyOTP = async (email, otp, purpose = 'verification') => {
  try {
    const otpRecord = await EmailOTP.findOne({
      email,
      otp,
      purpose,
      verified: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return { success: false, message: 'Invalid or expired OTP' };
    }

    otpRecord.verified = true;
    await otpRecord.save();

    return { success: true };
  } catch (error) {
    throw error;
  }
};

module.exports = {
  sendOTPEmail,
  verifyOTP,
  generateOTP
};