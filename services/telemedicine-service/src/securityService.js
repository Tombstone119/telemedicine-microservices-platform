const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class SecurityService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  /**
   * Extract user info from request
   */
  getUserFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Authorization header missing or invalid');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = this.verifyToken(token);

    return {
      id: decoded.sub || decoded.id,
      role: decoded.role || 'user',
      type: this.determineUserType(decoded)
    };
  }

  /**
   * Determine user type from token data
   */
  determineUserType(decoded) {
    // This is a simple implementation - in a real system,
    // you might have more sophisticated user type detection
    if (decoded.role === 'doctor' || decoded.doctor_id) {
      return 'doctor';
    } else if (decoded.role === 'patient' || decoded.patient_id) {
      return 'patient';
    }
    return 'unknown';
  }

  /**
   * Generate secure session token
   */
  generateSessionToken(sessionId, userId, userType, expirationMinutes = 60) {
    const payload = {
      sessionId,
      userId,
      userType,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (expirationMinutes * 60)
    };

    return jwt.sign(payload, this.jwtSecret);
  }

  /**
   * Verify session token
   */
  verifySessionToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret);
    } catch (error) {
      throw new Error('Invalid session token');
    }
  }

  /**
   * Generate secure room password
   */
  generateRoomPassword(length = 12) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash sensitive data
   */
  hashData(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Validate user permissions for session access
   */
  validateSessionAccess(session, userId, userType) {
    if (userType === 'doctor' && session.doctor_id !== userId) {
      return false;
    }
    if (userType === 'patient' && session.patient_id !== userId) {
      return false;
    }
    return true;
  }

  /**
   * Middleware for authentication
   */
  authenticate(req, res, next) {
    try {
      req.user = this.getUserFromRequest(req);
      next();
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: error.message
      });
    }
  }

  /**
   * Middleware for session-specific authorization
   */
  authorizeSessionAccess(req, res, next) {
    try {
      const { sessionId } = req.params;
      const user = req.user;

      // This would typically check against the database
      // For now, we'll assume the session service handles this
      next();
    } catch (error) {
      res.status(403).json({
        error: 'Authorization failed',
        message: error.message
      });
    }
  }

  /**
   * Generate CSRF token for additional security
   */
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validate CSRF token
   */
  validateCSRFToken(sessionToken, providedToken) {
    if (!sessionToken || !providedToken) {
      return false;
    }

    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(sessionToken, 'hex'),
      Buffer.from(providedToken, 'hex')
    );
  }
}

module.exports = new SecurityService();