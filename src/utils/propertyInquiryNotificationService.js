const PropertyInquiry = require("../models/PropertyInquiry");

class PropertyInquiryNotificationService {
  constructor(io) {
    this.io = io;
  }

  // Send new inquiry notification to property owner
  async notifyOwnerOfNewInquiry(inquiry) {
    try {
      const populatedInquiry = await PropertyInquiry.findById(inquiry._id)
        .populate('property', 'title propertyType monthlyRent images propertyId')
        .populate('tenant', 'fullName profilePhoto phonenumber')
        .populate('owner', 'fullName profilePhoto phonenumber');

      if (!populatedInquiry) {
        console.error('Inquiry not found for notification:', inquiry._id);
        return;
      }

      const ownerId = populatedInquiry.owner._id.toString();
      const notificationData = {
        type: 'new-property-inquiry',
        inquiry: populatedInquiry,
        title: 'New Property Inquiry',
        message: `${populatedInquiry.tenant.fullName} is interested in your property "${populatedInquiry.property.title}"`,
        timestamp: new Date(),
        priority: 'high'
      };

      // Send to owner's personal room
      this.io.to(ownerId).emit('new-property-inquiry', notificationData);
      
      // Send to owner's inquiry notification room
      this.io.to(`inquiry-notifications-${ownerId}`).emit('inquiry-notification', notificationData);

      console.log(`[NOTIFICATION] Sent new inquiry notification to owner ${ownerId}`);
      return true;

    } catch (error) {
      console.error('Error sending new inquiry notification:', error);
      return false;
    }
  }

  // Send inquiry accepted notification to tenant
  async notifyTenantOfAcceptedInquiry(inquiry, chat) {
    try {
      const populatedInquiry = await PropertyInquiry.findById(inquiry._id)
        .populate('property', 'title propertyType monthlyRent images propertyId')
        .populate('tenant', 'fullName profilePhoto phonenumber')
        .populate('owner', 'fullName profilePhoto phonenumber');

      if (!populatedInquiry) {
        console.error('Inquiry not found for notification:', inquiry._id);
        return;
      }

      const tenantId = populatedInquiry.tenant._id.toString();
      const notificationData = {
        type: 'inquiry-accepted',
        inquiry: populatedInquiry,
        chat: chat,
        title: 'Inquiry Accepted!',
        message: `${populatedInquiry.owner.fullName} accepted your inquiry for "${populatedInquiry.property.title}". You can now chat with them!`,
        timestamp: new Date(),
        priority: 'high',
        actionButton: {
          text: 'Start Chat',
          chatId: chat._id
        }
      };

      // Send to tenant's personal room
      this.io.to(tenantId).emit('inquiry-accepted', notificationData);
      
      // Send to tenant's inquiry notification room
      this.io.to(`inquiry-notifications-${tenantId}`).emit('inquiry-notification', notificationData);

      // Also emit new chat event
      this.io.to(tenantId).emit('new-chat', {
        chat: chat,
        message: `Chat created with ${populatedInquiry.owner.fullName}`,
        property: populatedInquiry.property,
        timestamp: new Date()
      });

      console.log(`[NOTIFICATION] Sent inquiry accepted notification to tenant ${tenantId}`);
      return true;

    } catch (error) {
      console.error('Error sending inquiry accepted notification:', error);
      return false;
    }
  }

  // Send inquiry declined notification to tenant
  async notifyTenantOfDeclinedInquiry(inquiry) {
    try {
      const populatedInquiry = await PropertyInquiry.findById(inquiry._id)
        .populate('property', 'title propertyType monthlyRent images propertyId')
        .populate('tenant', 'fullName profilePhoto phonenumber')
        .populate('owner', 'fullName profilePhoto phonenumber');

      if (!populatedInquiry) {
        console.error('Inquiry not found for notification:', inquiry._id);
        return;
      }

      const tenantId = populatedInquiry.tenant._id.toString();
      const notificationData = {
        type: 'inquiry-declined',
        inquiry: populatedInquiry,
        title: 'Inquiry Update',
        message: `${populatedInquiry.owner.fullName} has responded to your inquiry for "${populatedInquiry.property.title}"`,
        timestamp: new Date(),
        priority: 'medium'
      };

      // Send to tenant's personal room
      this.io.to(tenantId).emit('inquiry-declined', notificationData);
      
      // Send to tenant's inquiry notification room
      this.io.to(`inquiry-notifications-${tenantId}`).emit('inquiry-notification', notificationData);

      console.log(`[NOTIFICATION] Sent inquiry declined notification to tenant ${tenantId}`);
      return true;

    } catch (error) {
      console.error('Error sending inquiry declined notification:', error);
      return false;
    }
  }

  // Send inquiry expiration notification
  async notifyOfExpiredInquiry(inquiry) {
    try {
      const populatedInquiry = await PropertyInquiry.findById(inquiry._id)
        .populate('property', 'title propertyType monthlyRent images propertyId')
        .populate('tenant', 'fullName profilePhoto phonenumber')
        .populate('owner', 'fullName profilePhoto phonenumber');

      if (!populatedInquiry) {
        console.error('Inquiry not found for notification:', inquiry._id);
        return;
      }

      const tenantId = populatedInquiry.tenant._id.toString();
      const ownerId = populatedInquiry.owner._id.toString();

      // Notify tenant
      const tenantNotificationData = {
        type: 'inquiry-expired',
        inquiry: populatedInquiry,
        title: 'Inquiry Expired',
        message: `Your inquiry for "${populatedInquiry.property.title}" has expired`,
        timestamp: new Date(),
        priority: 'low'
      };

      this.io.to(tenantId).emit('inquiry-expired', tenantNotificationData);
      this.io.to(`inquiry-notifications-${tenantId}`).emit('inquiry-notification', tenantNotificationData);

      // Notify owner
      const ownerNotificationData = {
        type: 'inquiry-expired',
        inquiry: populatedInquiry,
        title: 'Inquiry Expired',
        message: `Inquiry from ${populatedInquiry.tenant.fullName} for "${populatedInquiry.property.title}" has expired`,
        timestamp: new Date(),
        priority: 'low'
      };

      this.io.to(ownerId).emit('inquiry-expired', ownerNotificationData);
      this.io.to(`inquiry-notifications-${ownerId}`).emit('inquiry-notification', ownerNotificationData);

      console.log(`[NOTIFICATION] Sent inquiry expiration notifications`);
      return true;

    } catch (error) {
      console.error('Error sending inquiry expiration notification:', error);
      return false;
    }
  }

  // Get pending inquiry count for owner
  async getPendingInquiryCount(ownerId) {
    try {
      const count = await PropertyInquiry.countDocuments({
        owner: ownerId,
        status: 'pending',
        expiresAt: { $gt: new Date() }
      });

      return count;
    } catch (error) {
      console.error('Error getting pending inquiry count:', error);
      return 0;
    }
  }

  // Send inquiry count update to owner
  async sendInquiryCountUpdate(ownerId) {
    try {
      const count = await this.getPendingInquiryCount(ownerId);
      
      this.io.to(ownerId).emit('inquiry-count-update', {
        pendingCount: count,
        timestamp: new Date()
      });

      console.log(`[NOTIFICATION] Sent inquiry count update to owner ${ownerId}: ${count}`);
      return count;

    } catch (error) {
      console.error('Error sending inquiry count update:', error);
      return 0;
    }
  }
}

module.exports = PropertyInquiryNotificationService;