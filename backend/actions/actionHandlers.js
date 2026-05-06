/**
 * Action Layer - Mock action handlers
 * Simulates real business integrations like booking systems and CRM
 */

import { v4 as uuidv4 } from 'uuid';

// Mock in-memory stores
const bookings = [];
const leads = [];

/**
 * Extract structured data from user message using LLM response
 */
function parseJSON(text) {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  } catch {
    return null;
  }
}

/**
 * ACTION: Book an appointment / schedule a meeting
 */
export async function bookAppointment(params) {
  const {
    name = 'Guest',
    email = '',
    date = 'Next available',
    time = '10:00 AM',
    service = 'General Consultation',
    notes = ''
  } = params;

  const booking = {
    id: `BK-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email,
    date,
    time,
    service,
    notes,
    status: 'confirmed',
    createdAt: new Date().toISOString()
  };

  bookings.push(booking);

  return {
    success: true,
    message: `✅ Booking confirmed! Your appointment has been scheduled.`,
    data: {
      bookingId: booking.id,
      name: booking.name,
      date: booking.date,
      time: booking.time,
      service: booking.service,
      confirmationMessage: `Booking ID: **${booking.id}** | ${booking.service} on ${booking.date} at ${booking.time}`
    }
  };
}

/**
 * ACTION: Create a sales lead in CRM
 */
export async function createLead(params) {
  const {
    name = 'Prospect',
    email = '',
    company = '',
    phone = '',
    interest = 'General Inquiry',
    budget = 'Not specified',
    message = ''
  } = params;

  const lead = {
    id: `LEAD-${uuidv4().slice(0, 8).toUpperCase()}`,
    name,
    email,
    company,
    phone,
    interest,
    budget,
    message,
    status: 'new',
    score: Math.floor(Math.random() * 40) + 60, // Mock lead score 60-100
    createdAt: new Date().toISOString()
  };

  leads.push(lead);

  return {
    success: true,
    message: `✅ Lead captured successfully! Our team will reach out within 24 hours.`,
    data: {
      leadId: lead.id,
      name: lead.name,
      company: lead.company || 'N/A',
      interest: lead.interest,
      leadScore: lead.score,
      confirmationMessage: `Lead ID: **${lead.id}** | Score: ${lead.score}/100 | Our sales team will contact you at ${email || 'your provided contact'}`
    }
  };
}

/**
 * ACTION: Check order/ticket status
 */
export async function checkStatus(params) {
  const { orderId = '', ticketId = '' } = params;
  const id = orderId || ticketId || `ORD-${Math.floor(Math.random() * 90000) + 10000}`;
  
  const statuses = ['Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Pending Review'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  
  return {
    success: true,
    message: `Status retrieved for ${id}`,
    data: {
      id,
      status,
      lastUpdated: new Date().toISOString(),
      estimatedCompletion: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      confirmationMessage: `**${id}** | Status: ${status} | Updated: ${new Date().toLocaleDateString()}`
    }
  };
}

/**
 * ACTION: Route to human support agent
 */
export async function escalateToHuman(params, sessionId) {
  const { name = 'User', issue = 'General support', priority = 'normal' } = params;
  const ticketId = `TKT-${uuidv4().slice(0, 6).toUpperCase()}`;

  // Update session status in DB if sessionId is provided
  if (sessionId) {
    try {
      const { updateSessionStatus } = await import('../memory/sessionMemory.js');
      await updateSessionStatus(sessionId, 'live_agent', true);
    } catch (err) {
      console.error('[Action:Escalate] Failed to update session status:', err.message);
    }
  }

  return {
    success: true,
    message: `🎧 Escalated to human agent`,
    data: {
      ticketId,
      estimatedWait: priority === 'high' ? '2-5 minutes' : '10-15 minutes',
      confirmationMessage: `Ticket **${ticketId}** created. A support agent will assist you shortly. Estimated wait: ${priority === 'high' ? '2-5 min' : '10-15 min'}`
    }
  };
}

/**
 * ACTION: RPA - Extract structured data from unstructured text
 */
export async function extractData(params) {
  const { 
    rawText = '', 
    schema = 'Vendor, Total, Date, LineItems', 
    targetSystem = 'MockERP' 
  } = params;

  // In a real RPA case, this would call an API like UiPath or a dedicated OCR.
  // Here the LLM has already done the heavy lifting of extraction.
  
  return {
    success: true,
    message: `🤖 RPA: Data extracted and synced to ${targetSystem}`,
    data: {
      syncId: `RPA-${uuidv4().slice(0, 8).toUpperCase()}`,
      status: 'synced',
      details: params.extractedData || {}, // Passed from actionAgent
      confirmationMessage: `✅ RPA Sync Complete | System: **${targetSystem}** | ID: **RPA-${uuidv4().slice(0, 5)}**`
    }
  };
}

/**
 * ACTION: RPA - Multi-stage automation workflow
 */
export async function processAutomation(params) {
  const { workflowType = 'general', data = {} } = params;
  const workflowId = `WF-${uuidv4().slice(0, 6).toUpperCase()}`;

  // Simulate multiple steps
  const steps = [
    { step: 'Validation', status: 'completed' },
    { step: 'ERP Sync', status: 'completed' },
    { step: 'External API Call', status: 'completed' },
    { step: 'Confirmation Email', status: 'queued' }
  ];

  return {
    success: true,
    message: `🤖 RPA Workflow [${workflowType}] triggered successfully.`,
    data: {
      workflowId,
      steps,
      details: data,
      confirmationMessage: `Automation **${workflowId}** for *${workflowType}* is now running. All validation steps passed.`
    }
  };
}

/**
 * Executes an action by name with parameters
 */
export async function executeAction(actionName, params, sessionId) {
  const actions = {
    bookAppointment,
    createLead,
    checkStatus,
    escalateToHuman,
    extractData,
    processAutomation
  };

  const handler = actions[actionName];
  if (!handler) {
    return {
      success: false,
      message: `Unknown action: ${actionName}`,
      data: {}
    };
  }

  return await handler(params || {}, sessionId);
}

/**
 * Get all stored data for analytics
 */
export function getActionStats() {
  return {
    totalBookings: bookings.length,
    totalLeads: leads.length,
    recentBookings: bookings.slice(-5),
    recentLeads: leads.slice(-5)
  };
}

export default { bookAppointment, createLead, checkStatus, escalateToHuman, executeAction, getActionStats };
