# Payment Service

The Payment Service handles secure payment processing for telemedicine consultations using Stripe integration and additional gateways (PayHere, Dialog Genie, FriMi, PayPal sandbox). It manages payment initiation, processing, webhooks, refunds, and invoice generation.

## Features

- **Secure Payment Processing**: Stripe integration for PCI-compliant payments
- **Sri Lankan Gateway Support**: PayHere, Dialog Genie, FriMi sandbox mode
- **PayPal Sandbox**: International payment support via Paypal sandbox
- **Payment Methods**: Support for multiple payment methods (cards, digital wallets)
- **Webhook Handling**: Real-time payment status updates via webhooks
- **Invoice Generation**: Automatic invoice creation and PDF generation
- **Refund Management**: Secure refund processing with audit trails
- **Event Publishing**: Integration with RabbitMQ for microservice communication
- **Role-based Access**: Patient, doctor, and admin access controls

## API Endpoints

### Payment Operations

#### Initiate Payment
```http
POST /api/payments/initiate
Authorization: Bearer <token>
Content-Type: application/json

{
  "appointmentId": "appointment-123",
  "paymentMethodId": "pm_1234567890",
  "amount": 100.00,
  "currency": "usd"
}
```

#### Get Payment Details
```http
GET /api/payments/:id
Authorization: Bearer <token>
```

#### Get User Payments
```http
GET /api/payments?page=1&limit=10&status=paid
Authorization: Bearer <token>
```

#### Refund Payment
```http
POST /api/payments/:id/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 50.00,
  "reason": "Patient requested refund"
}
```

### Webhook Endpoints

#### Stripe Webhook
```http
POST /api/payments/webhook/stripe
X-Stripe-Signature: <signature>
Content-Type: application/json
```

### Invoice Operations

#### Generate Invoice
```http
POST /api/invoices/generate/:paymentId
Authorization: Bearer <token>
```

#### Get Invoice
```http
GET /api/invoices/:id
Authorization: Bearer <token>
```

#### Download Invoice PDF
```http
GET /api/invoices/:id/pdf
Authorization: Bearer <token>
```

#### Send Invoice Email
```http
POST /api/invoices/:id/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "patient@example.com"
}
```

### Payment Methods

#### Add Payment Method
```http
POST /api/payments/payment-methods
Authorization: Bearer <token>
Content-Type: application/json

{
  "paymentMethodId": "pm_1234567890",
  "type": "card",
  "last4": "4242"
}
```

#### Get Payment Methods
```http
GET /api/payments/payment-methods
Authorization: Bearer <token>
```

#### Remove Payment Method
```http
DELETE /api/payments/payment-methods/:id
Authorization: Bearer <token>
```

## Database Schema

### Payments Table
- `id`: Primary key
- `appointment_id`: Foreign key to appointment
- `patient_id`: Foreign key to patient
- `amount`: Payment amount
- `currency`: Payment currency
- `status`: Payment status (pending, paid, failed, refunded)
- `payment_method`: Payment method used
- `transaction_id`: Stripe transaction ID
- `paid_at`: Payment completion timestamp
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

### Payment Attempts Table
- `id`: Primary key
- `payment_id`: Foreign key to payment
- `attempt_number`: Attempt sequence number
- `status`: Attempt status
- `error_message`: Error details if failed
- `attempted_at`: Attempt timestamp

### Invoices Table
- `id`: Primary key
- `invoice_id`: Unique invoice identifier
- `payment_id`: Foreign key to payment
- `patient_id`: Foreign key to patient
- `doctor_id`: Foreign key to doctor
- `amount`: Invoice amount
- `tax_amount`: Tax amount
- `total_amount`: Total amount
- `status`: Invoice status
- `issued_at`: Invoice creation timestamp
- `due_date`: Payment due date

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/telemedicine_payments

# RabbitMQ
RABBITMQ_URL=amqp://localhost

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayHere (Sri Lanka)
PAYHERE_MERCHANT_ID=121212
PAYHERE_RETURN_URL=http://localhost:3000/payment/success
PAYHERE_CANCEL_URL=http://localhost:3000/payment/cancel
PAYHERE_NOTIFY_URL=http://localhost:3005/api/payments/webhook/payhere

# Dialog Genie (Sri Lanka)
DIALOG_GENIE_API_KEY=your-dialog-genie-api-key
DIALOG_GENIE_URL=https://sandbox.dialog.lk/genie/pay

# FriMi (Sri Lanka)
FRIMI_API_KEY=your-frimi-api-key
FRIMI_URL=https://sandbox.frimi.lk/invoice

# PayPal Sandbox
PAYPAL_SANDBOX_URL=https://www.sandbox.paypal.com/checkoutnow

# JWT
JWT_SECRET=your-jwt-secret-key

# Service
PORT=3005
NODE_ENV=development

# External Services
APPOINTMENT_SERVICE_URL=http://localhost:3002
AUTH_SERVICE_URL=http://localhost:3001
NOTIFICATION_SERVICE_URL=http://localhost:3006

# Payment Config
CURRENCY=usd
TAX_RATE=0.1
```

## Events Published

- `payment.initiated`: When payment is initiated
- `payment.completed`: When payment is successfully completed
- `payment.failed`: When payment fails
- `payment.refunded`: When payment is refunded
- `invoice.generated`: When invoice is created
- `invoice.sent`: When invoice is emailed
- `invoice.status_updated`: When invoice status changes
- `payment_method.added`: When payment method is added
- `payment_method.removed`: When payment method is removed

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Run database migrations:
```bash
npm run migrate
```

4. Start the service:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Docker

Build and run with Docker:
```bash
docker build -t payment-service .
docker run -p 3005:3005 --env-file .env payment-service
```

## Testing

Run tests:
```bash
npm test
```

## Security Features

- JWT-based authentication
- Role-based access control
- Stripe webhook signature verification
- PCI-compliant payment processing
- Input validation and sanitization
- SQL injection prevention
- Rate limiting (recommended to implement)

## Error Handling

The service implements comprehensive error handling:
- Payment validation errors
- Stripe API errors
- Database connection errors
- Authentication/authorization errors
- Webhook processing errors

All errors are logged and appropriate HTTP status codes are returned.

## Monitoring

- Health check endpoint: `GET /health`
- Structured logging with Morgan
- Event publishing for audit trails
- Database connection monitoring

## Dependencies

- `express`: Web framework
- `pg`: PostgreSQL client
- `stripe`: Payment processing
- `amqplib`: RabbitMQ client
- `joi`: Input validation
- `helmet`: Security middleware
- `morgan`: HTTP request logger
- `cors`: Cross-origin resource sharing