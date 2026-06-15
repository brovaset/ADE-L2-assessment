import Groq from 'groq-sdk';

/**
 * LLM Helper for categorizing customer support messages
 * Using Groq API for AI-powered categorization
 */

const GROQ_MODEL = 'llama-3.3-70b-versatile';

let groqClient = null;

function getGroqClient() {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return null;
  }

  if (!groqClient) {
    groqClient = new Groq({
      apiKey,
      dangerouslyAllowBrowser: true // Required for browser-based calls (not recommended for production!)
    });
  }

  return groqClient;
}

function parseCategoryFromContent(content) {
  const lower = content.toLowerCase();

  if (lower.includes('billing')) {
    return 'Billing Issue';
  }
  if (lower.includes('technical') || lower.includes('bug')) {
    return 'Technical Problem';
  }
  if (lower.includes('feature')) {
    return 'Feature Request';
  }
  if (lower.includes('inquiry') || lower.includes('question')) {
    return 'General Inquiry';
  }

  return 'Unknown';
}

function formatGroqError(error) {
  const status = error?.status ?? error?.response?.status;

  if (status === 429) {
    return 'Groq rate limit reached (429). Local routing is still available — retry AI analysis in a moment.';
  }
  if (status === 401 || status === 403) {
    return 'Invalid Groq API key. Add a valid VITE_GROQ_API_KEY to .env.local and restart the dev server.';
  }
  if (error?.message?.includes('Failed to fetch') || error?.code === 'ECONNREFUSED') {
    return 'Network error while contacting Groq. Check your connection and try again.';
  }

  return error?.message || 'Groq AI categorization failed unexpectedly.';
}

/**
 * Fast-track, synchronous rule-based categorization for immediate UI updates.
 *
 * @param {string} message
 * @returns {{ category: string, reasoning: string }}
 */
export function getLocalCategorization(message) {
  const lowerMessage = message.toLowerCase();

  const reasoningVariations = {
    billing: [
      'Based on keywords related to payments and billing, this appears to be a billing-related inquiry. The customer may need assistance with account charges or payment issues.',
      'This message contains billing terminology. The customer is likely experiencing issues with payments, invoices, or account charges.',
      'The message references financial matters related to the customer\'s account. This suggests a billing or payment concern that requires attention.',
    ],
    technical: [
      'This message describes technical difficulties or system errors. The customer is reporting functionality issues that may require engineering review.',
      'Based on error-related keywords, this appears to be a technical support issue. The customer is experiencing problems with product functionality.',
      'The message indicates a technical problem or bug. This requires investigation from the technical support team.',
      'System-related issues are mentioned in this message. The customer needs technical assistance to resolve functionality problems.',
    ],
    feature: [
      'This message suggests improvements or new functionality. The customer is providing product feedback and feature suggestions.',
      'The customer is requesting enhancements to the product. This appears to be a feature request that should be reviewed by the product team.',
      'Based on the language used, this seems to be a suggestion for product improvements rather than a support issue.',
    ],
    inquiry: [
      'This appears to be a general question about the product or service. The customer is seeking information or clarification.',
      'The message contains questions that don\'t indicate a specific problem. This is likely a general inquiry requiring informational support.',
      'Based on the question format, this seems to be an information request rather than a technical or billing issue.',
    ],
    positive: [
      'This message contains positive sentiment and appreciation. While not a support request, it may warrant acknowledgment.',
      'The customer is expressing satisfaction or gratitude. This doesn\'t appear to require immediate support action.',
    ],
    ambiguous: [
      'The message content is unclear or doesn\'t match standard support categories. Manual review may be needed for proper categorization.',
      'This message doesn\'t contain clear indicators for automatic categorization. Human review recommended.',
    ],
  };

  const getRandomReasoning = (category) => {
    const reasons = reasoningVariations[category];
    return reasons[Math.floor(Math.random() * reasons.length)];
  };

  if (
    lowerMessage.includes('bill') || lowerMessage.includes('payment') ||
    lowerMessage.includes('charge') || lowerMessage.includes('invoice') ||
    lowerMessage.includes('credit card') || lowerMessage.includes('subscription') ||
    lowerMessage.includes('refund') || (lowerMessage.includes('cancel') && lowerMessage.includes('account'))
  ) {
    return {
      category: 'Billing Issue',
      reasoning: getRandomReasoning('billing'),
    };
  }

  if (
    lowerMessage.includes('bug') || lowerMessage.includes('error') ||
    lowerMessage.includes('broken') || lowerMessage.includes('not working') ||
    lowerMessage.includes('crash') || lowerMessage.includes('down') ||
    lowerMessage.includes('server') || lowerMessage.includes('loading') ||
    lowerMessage.includes('slow') || lowerMessage.includes('issue') ||
    (lowerMessage.includes('problem') && !lowerMessage.includes('no problem'))
  ) {
    return {
      category: 'Technical Problem',
      reasoning: getRandomReasoning('technical'),
    };
  }

  if (
    lowerMessage.includes('feature') ||
    (lowerMessage.includes('add') && (lowerMessage.includes('please') || lowerMessage.includes('could'))) ||
    lowerMessage.includes('improve') || lowerMessage.includes('would like to see') ||
    lowerMessage.includes('suggestion') || lowerMessage.includes('wish') ||
    (lowerMessage.includes('could you') && lowerMessage.includes('add')) ||
    lowerMessage.includes('enhancement') || lowerMessage.includes('would be great')
  ) {
    return {
      category: 'Feature Request',
      reasoning: getRandomReasoning('feature'),
    };
  }

  if (
    (lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) &&
    !lowerMessage.includes('but') && !lowerMessage.includes('however')
  ) {
    return {
      category: 'General Inquiry',
      reasoning: getRandomReasoning('positive'),
    };
  }

  if (
    lowerMessage.includes('how') || lowerMessage.includes('what') ||
    lowerMessage.includes('when') || lowerMessage.includes('where') ||
    lowerMessage.includes('can i') || lowerMessage.includes('is there') ||
    lowerMessage.includes('?')
  ) {
    return {
      category: 'General Inquiry',
      reasoning: getRandomReasoning('inquiry'),
    };
  }

  return {
    category: 'General Inquiry',
    reasoning: getRandomReasoning('ambiguous'),
  };
}

/**
 * Slow-track Groq categorization. Throws on configuration/network/API failures
 * so callers can isolate errors without affecting local metrics.
 *
 * @param {string} message
 * @returns {Promise<{ category: string, reasoning: string }>}
 */
export async function fetchGroqCategorization(message) {
  const groq = getGroqClient();
  if (!groq) {
    throw new Error(
      'Missing VITE_GROQ_API_KEY. Copy .env.example to .env.local, add your key, and restart the dev server.'
    );
  }

  try {
    const response = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'user',
          content: `Categorize this customer support message: ${message}`,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('Groq returned an empty response.');
    }

    return {
      category: parseCategoryFromContent(content),
      reasoning: content,
    };
  } catch (error) {
    throw new Error(formatGroqError(error));
  }
}

/**
 * @deprecated Use getLocalCategorization + fetchGroqCategorization for the split pipeline.
 */
export async function categorizeMessage(message) {
  try {
    return await fetchGroqCategorization(message);
  } catch {
    return getLocalCategorization(message);
  }
}
