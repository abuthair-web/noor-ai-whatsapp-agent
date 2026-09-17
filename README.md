# Noor AI WhatsApp Agent

AI-powered WhatsApp Business Agent developed by Noor Labs.

## Architecture

Customer
↓
WhatsApp
↓
Meta WhatsApp Cloud API
↓
Cloud Run
↓
Noor AI Agent
↓
Gemini
↓
Business Knowledge / Tools / Database
↓
Meta WhatsApp Cloud API
↓
Customer

## Current Features

- WhatsApp webhook verification
- Incoming WhatsApp messages
- Gemini AI responses
- Outgoing WhatsApp messages
- Business configuration
- Agent architecture
- Tool architecture
- Customer architecture
- Booking architecture
- Order architecture
- Payment architecture
- CRM architecture
- Reminder architecture
- Human handoff architecture

## Environment Variables

GEMINI_API_KEY=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
PORT=8080
BUSINESS_ID=demo-business

## Deployment

The application is designed to run on Google Cloud Run.

## Security

Never commit:

- Gemini API keys
- WhatsApp access tokens
- Database credentials
- .env files

## Developer

Noor Labs
