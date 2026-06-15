import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import { fetchGroqCategorization, getLocalCategorization } from '../utils/llmHelper'
import { calculateUrgency } from '../utils/urgencyScorer'
import { getRecommendedAction } from '../utils/templates'

function loadHistory() {
  return JSON.parse(localStorage.getItem('triageHistory') || '[]')
}

function appendToHistory(record) {
  const history = loadHistory()
  history.push(record)
  localStorage.setItem('triageHistory', JSON.stringify(history))
  return history
}

function urgencyBadgeClass(urgency) {
  if (urgency === 'High') return 'bg-red-200 text-red-900'
  if (urgency === 'Medium') return 'bg-yellow-200 text-yellow-900'
  return 'bg-green-200 text-green-900'
}

function AnalysisResultsPanel({ results, aiStatus, aiError, isAiLoading, canCopyResults, onCopy }) {
  if (!results) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center">
        <div className="text-4xl mb-3">📋</div>
        <p className="text-gray-600 font-medium">No active analysis</p>
        <p className="text-sm text-gray-500 mt-1">
          Submit a message to see urgency, routing, and AI insights here.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-5 border border-blue-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900">Current Analysis</h2>
        {isAiLoading && (
          <span className="text-xs font-semibold text-blue-600 animate-pulse">AI refining…</span>
        )}
      </div>

      <p className="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 line-clamp-3">
        "{results.message}"
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Category</div>
          <div className="inline-block bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-semibold">
            {results.category}
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Urgency</div>
          <div className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold ${urgencyBadgeClass(results.urgency)}`}>
            {results.urgency}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">Recommended Action</div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
          <p className="text-sm text-gray-800">{results.recommendedAction}</p>
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">AI Insights</div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          {isAiLoading && (
            <div className="space-y-2 animate-pulse" aria-live="polite" aria-busy="true">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                Waiting for Groq AI categorization…
              </div>
              <div className="h-2.5 bg-gray-200 rounded w-full" />
              <div className="h-2.5 bg-gray-200 rounded w-5/6" />
              <div className="h-2.5 bg-gray-200 rounded w-4/6" />
            </div>
          )}

          {aiStatus === 'error' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {aiError}
              </div>
              <div className="prose prose-sm max-w-none text-gray-700">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Local fallback reasoning
                </p>
                <ReactMarkdown>{results.reasoning}</ReactMarkdown>
              </div>
            </div>
          )}

          {aiStatus === 'complete' && (
            <div className="prose prose-sm max-w-none text-gray-700">
              <ReactMarkdown>{results.reasoning}</ReactMarkdown>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <button
          onClick={onCopy}
          disabled={!canCopyResults}
          className={`px-4 py-2 rounded-lg text-sm font-semibold ${
            canCopyResults
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              : 'bg-gray-50 text-gray-400 cursor-not-allowed'
          }`}
        >
          📋 Copy Results
        </button>
      </div>
    </div>
  )
}

function HistoryTimeline({ history, activeTimestamp }) {
  const timeline = [...history].reverse()

  if (timeline.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-500">Completed analyses will appear in this timeline.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {timeline.map((item, index) => {
        const isActive = item.timestamp === activeTimestamp
        return (
          <div
            key={`${item.timestamp}-${index}`}
            className={`rounded-lg border p-4 transition-colors ${
              isActive
                ? 'border-blue-300 bg-blue-50 shadow-sm'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="text-xs text-gray-500">
                {new Date(item.timestamp).toLocaleString()}
              </div>
              {isActive && (
                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                  Latest
                </span>
              )}
            </div>
            <p className="text-sm text-gray-800 font-medium mb-2 line-clamp-2">
              "{item.message}"
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-semibold">
                {item.category}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold ${urgencyBadgeClass(item.urgency)}`}>
                {item.urgency}
              </span>
            </div>
            <p className="text-xs text-gray-600 mt-2 line-clamp-2">{item.recommendedAction}</p>
          </div>
        )
      })}
    </div>
  )
}

function AnalyzePage() {
  const [message, setMessage] = useState(() => {
    const exampleMessage = localStorage.getItem('exampleMessage')
    if (exampleMessage) {
      localStorage.removeItem('exampleMessage')
      return exampleMessage
    }
    return ''
  })
  const [results, setResults] = useState(null)
  const [aiStatus, setAiStatus] = useState('idle')
  const [aiError, setAiError] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const requestIdRef = useRef(0)

  const finalizeAnalysis = (finalized, status, errorMessage = null) => {
    setResults(finalized)
    setAiStatus(status)
    setAiError(errorMessage)
    setHistory(appendToHistory(finalized))
  }

  const handleAnalyze = () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage) {
      alert('Please enter a message to analyze')
      return
    }

    const requestId = ++requestIdRef.current
    const timestamp = new Date().toISOString()

    const urgency = calculateUrgency(trimmedMessage)
    const { category: localCategory, reasoning: localReasoning } = getLocalCategorization(trimmedMessage)
    const recommendedAction = getRecommendedAction(localCategory)

    const fastTrackResult = {
      message: trimmedMessage,
      category: localCategory,
      urgency,
      recommendedAction,
      reasoning: null,
      timestamp,
    }

    setResults(fastTrackResult)
    setAiStatus('loading')
    setAiError(null)
    setMessage('')

    fetchGroqCategorization(trimmedMessage)
      .then(({ category, reasoning }) => {
        if (requestId !== requestIdRef.current) return

        finalizeAnalysis(
          {
            message: trimmedMessage,
            category,
            urgency,
            recommendedAction: getRecommendedAction(category),
            reasoning,
            timestamp,
          },
          'complete'
        )
      })
      .catch((error) => {
        if (requestId !== requestIdRef.current) return

        finalizeAnalysis(
          {
            message: trimmedMessage,
            category: localCategory,
            urgency,
            recommendedAction,
            reasoning: localReasoning,
            timestamp,
          },
          'error',
          error.message
        )
      })
  }

  const handleClear = () => {
    requestIdRef.current += 1
    setMessage('')
    setResults(null)
    setAiStatus('idle')
    setAiError(null)
  }

  const isAiLoading = aiStatus === 'loading'
  const canCopyResults = results && aiStatus !== 'loading' && results.reasoning

  const handleCopyResults = () => {
    if (!results) return
    const text = `Category: ${results.category}\nUrgency: ${results.urgency}\nRecommendation: ${results.recommendedAction}\n\nReasoning: ${results.reasoning || aiError || 'Pending AI analysis'}`
    navigator.clipboard.writeText(text)
    alert('Results copied to clipboard!')
  }

  return (
    <div className="h-[calc(100vh-4rem)] bg-gray-50">
      <div className="flex h-full max-w-[1600px] mx-auto">
        {/* Left panel — fixed input column */}
        <aside className="w-full max-w-md shrink-0 border-r border-gray-200 bg-white flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h1 className="text-xl font-bold text-gray-900">Analyze Message</h1>
            <p className="text-sm text-gray-600 mt-1">
              Paste and triage without leaving the input pane.
            </p>
          </div>

          <div className="flex flex-col flex-1 p-6 min-h-0">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Customer Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Paste customer message here..."
              className="flex-1 min-h-[240px] w-full border border-gray-300 rounded-lg p-3 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-sm text-gray-500 mt-2">
              {message.length} characters
            </div>

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleAnalyze}
                disabled={isAiLoading}
                className={`flex-1 py-3 rounded-lg font-semibold ${
                  isAiLoading
                    ? 'bg-blue-500 text-white cursor-wait'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isAiLoading ? 'AI analysis in progress…' : 'Analyze Message'}
              </button>
              <button
                onClick={handleClear}
                className="px-5 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
              >
                Clear
              </button>
            </div>
          </div>
        </aside>

        {/* Right panel — scrollable results + timeline */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            <AnalysisResultsPanel
              results={results}
              aiStatus={aiStatus}
              aiError={aiError}
              isAiLoading={isAiLoading}
              canCopyResults={canCopyResults}
              onCopy={handleCopyResults}
            />

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-gray-900">Session Timeline</h2>
                <span className="text-sm text-gray-500">{history.length} recorded</span>
              </div>
              <HistoryTimeline
                history={history}
                activeTimestamp={results?.timestamp}
              />
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AnalyzePage
