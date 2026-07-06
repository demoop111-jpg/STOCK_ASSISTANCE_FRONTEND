# Tally Chat Frontend - React JS

WhatsApp-style customer chat frontend for stock inquiry + booking request.

## Features

- React JS + Vite
- WhatsApp-style chat UI
- Check stock by item code
- Book order with quantity, unit, name, mobile, city, transport name, remark
- Contact salesperson WhatsApp link
- Mock mode fallback until backend is ready
- Backend-ready API layer

## Run

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## Backend API expected later

Set `.env`:

```env
VITE_API_URL=http://localhost:5000
VITE_SALESPERSON_WHATSAPP=91XXXXXXXXXX
VITE_COMPANY_NAME=Orange Decore
```

Expected endpoints:

```text
POST /api/chat/check-stock
POST /api/orders/book
```

### POST /api/chat/check-stock request

```json
{ "productCode": "SP-201" }
```

### POST /api/chat/check-stock response

```json
{
  "success": true,
  "productCode": "SP-201",
  "available": true,
  "quantityText": "25 PCS",
  "stockStatus": "In Stock",
  "lastSyncAt": "2026-06-19T10:30:00.000Z"
}
```

### POST /api/orders/book request

```json
{
  "productCode": "SP-201",
  "requestedQty": 10,
  "requestedUnit": "PCS",
  "customerName": "Rahul Patel",
  "mobile": "9876543210",
  "city": "Bhuj",
  "transportName": "Patel Transport",
  "remark": "Urgent dispatch"
}
```

### POST /api/orders/book response

```json
{
  "success": true,
  "orderRequestId": "ORG-1001",
  "whatsappLink": "https://wa.me/91...",
  "message": "Booking request created"
}
```
