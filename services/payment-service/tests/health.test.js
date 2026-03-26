const request = require('supertest');
const app = require('../src/index');

describe('Payment Service', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('service', 'payment-service');
      expect(response.body).toHaveProperty('status', 'healthy');
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app)
        .get('/unknown-route')
        .expect(404);
    });
  });

  describe('GET /api/payments/gateways', () => {
    it('should return supported gateways', async () => {
      const response = await request(app)
        .get('/api/payments/gateways')
        .expect(200);

      expect(response.body).toHaveProperty('gateways');
      expect(Array.isArray(response.body.gateways)).toBe(true);
      expect(response.body.gateways).toEqual(expect.arrayContaining(['stripe', 'payhere', 'dialog_genie', 'frimi', 'paypal']));
    });
  });
});