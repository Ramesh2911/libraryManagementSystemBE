import { Request, Response } from 'express';
import OpenAI from 'openai';
import { getTenantPrisma } from '../config/prisma';

// Initialize OpenAI conditionally in case the key isn't provided during dev
const openai = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'sk-placeholder-api-key'
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

export const handleAiQuery = async (req: Request, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const prismaTenant = getTenantPrisma(tenantId);
    
    const { query_text } = req.body;
    if (!query_text) {
      return res.status(400).json({ error: 'query_text is required' });
    }
    
    // 1. Intent Detection & Context Gathering
    const text = query_text.toLowerCase();
    let contextSummary: any = {};

    if (text.includes('revenue') || text.includes('fee')) {
      const payments = await prismaTenant.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'completed' }
      });
      contextSummary.totalRevenue = payments._sum.amount || 0;
      
      const overdues = await prismaTenant.overdueTracking.count({
        where: { recovery_status: 'pending' }
      });
      contextSummary.pendingOverdues = overdues;
    }

    if (text.includes('occupancy') || text.includes('seat') || text.includes('student')) {
      const seats = await prismaTenant.seat.groupBy({
        by: ['status'],
        _count: { seat_id: true }
      });
      contextSummary.seatStatus = seats;
      
      const activeStudents = await prismaTenant.student.count({
        where: { status: 'active' }
      });
      contextSummary.activeStudents = activeStudents;
    }

    // 2. Call External LLM API
    let llmResponse = '';

    if (openai) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini', // Cost-effective model for this use case
          messages: [
            {
              role: 'system',
              content: `You are SmartBrain, an AI assistant for a library management system. 
You are speaking to the library owner. 
Answer their queries strictly based on the following JSON data context from their database: 
${JSON.stringify(contextSummary)}.
If the data does not contain the answer, politely say you don't have enough information.`
            },
            {
              role: 'user',
              content: query_text
            }
          ],
          max_tokens: 150,
          temperature: 0.3 // Low temperature for factual responses
        });
        llmResponse = completion.choices[0].message.content || 'No response generated.';
      } catch (aiErr) {
        console.error('OpenAI API Error:', aiErr);
        llmResponse = 'Error communicating with the AI service.';
      }
    } else {
      llmResponse = `(OpenAI Not Configured). Based on your data: ${JSON.stringify(contextSummary)}.`;
    }

    // 3. Log Query for Audit
    await prismaTenant.aiQueryLog.create({
      data: {
        tenant_id: tenantId,
        actor_id: req.user.sub,
        query_text,
        context_summary: contextSummary,
        response_summary: llmResponse
      }
    });

    res.json({ answer: llmResponse, contextUsed: contextSummary });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to process AI query' });
  }
};
