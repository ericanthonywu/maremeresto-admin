import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi, errorMessage } from '../api/client'
import { useAuth } from '../context/AuthContext'
import type {
  FeedbackAISummaryResponse,
  OrderFeedbackAdminItem,
  OrderItemFeedback,
} from '../types'

export const FeedbackPage: React.FC = () => {
  const { isOwner, activeBranchId, branches } = useAuth()

  // Selected filter states
  const [selectedBranch, setSelectedBranch] = useState<string>(activeBranchId ?? '')
  const [ratingFilter, setRatingFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [page, setPage] = useState<number>(1)
  const limit = 10

  // Modal detail state
  const [detailItem, setDetailItem] = useState<OrderFeedbackAdminItem | null>(null)

  // AI Summary manual trigger / refresh state
  const [isGeneratingAI, setIsGeneratingAI] = useState(false)
  const [aiCustomResult, setAiCustomResult] = useState<FeedbackAISummaryResponse | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const effectiveBranchId = isOwner ? (selectedBranch || undefined) : (activeBranchId || undefined)

  // 1. Fetch Analytics
  const {
    data: analytics,
    refetch: refetchAnalytics,
  } = useQuery({
    queryKey: ['feedback-analytics', effectiveBranchId],
    queryFn: () => adminApi.getFeedbackAnalytics(effectiveBranchId),
  })

  // 2. Fetch Review List
  const {
    data: feedbackList,
    isLoading: listLoading,
    refetch: refetchList,
  } = useQuery({
    queryKey: [
      'feedback-list',
      effectiveBranchId,
      ratingFilter,
      searchQuery,
      page,
    ],
    queryFn: () =>
      adminApi.getFeedback({
        branch_id: effectiveBranchId,
        rating: ratingFilter ? Number(ratingFilter) : undefined,
        search: searchQuery.trim() || undefined,
        limit,
        offset: (page - 1) * limit,
      }),
  })

  const handleGenerateAI = async () => {
    setIsGeneratingAI(true)
    setAiError(null)
    try {
      const res = await adminApi.getFeedbackAISummary(effectiveBranchId)
      setAiCustomResult(res)
    } catch (err) {
      setAiError(errorMessage(err, 'Gagal menghasilkan analisis AI Gemini.'))
    } finally {
      setIsGeneratingAI(false)
    }
  }

  const renderStars = (rating: number, max = 5) => (
    <span className="inline-flex items-center gap-0.5 text-amber-400" aria-label={`${rating} dari ${max} bintang`}>
      {Array.from({ length: max }, (_, i) => (
        <i
          key={i}
          className={`fa-solid fa-star text-[11px] ${
            i < rating ? 'text-amber-400' : 'text-stone-200'
          }`}
          aria-hidden="true"
        />
      ))}
    </span>
  )

  const formatWhatsAppLink = (phone: string, customerName: string, orderNumber: string) => {
    const cleanPhone = phone.replace(/\D/g, '')
    const msg = encodeURIComponent(
      `Halo Kak ${customerName}, terima kasih atas ulasan Kakak untuk pesanan ${orderNumber} di Mareme Group. Kami sangat menghargai masukan Kakak!`
    )
    return `https://wa.me/${cleanPhone}?text=${msg}`
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-base">
              <i className="fa-solid fa-star" aria-hidden="true" />
            </span>
            <div>
              <h1 className="font-serif font-bold text-lg text-stone-900 leading-tight">
                Rating & Ulasan Pelanggan
              </h1>
              <p className="text-xs text-stone-500">
                Analisis kepuasan pelanggan, ulasan menu, feedback resto, serta rekomendasi instan AI.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Branch filter if Owner */}
          {isOwner && (
            <select
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value)
                setPage(1)
                setAiCustomResult(null)
              }}
              aria-label="Pilih cabang untuk difilter"
              className="px-3.5 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-brand-500 text-stone-700"
            >
              <option value="">Semua Outlet (Network-wide)</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => {
              void refetchAnalytics()
              void refetchList()
            }}
            className="px-3.5 py-2 text-xs font-bold bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-all flex items-center gap-1.5"
            title="Segarkan Data"
          >
            <i className="fa-solid fa-arrows-rotate text-[11px]" aria-hidden="true" />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={handleGenerateAI}
            disabled={isGeneratingAI}
            className="px-4 py-2 text-xs font-bold bg-gradient-to-r from-brand-600 to-amber-600 hover:from-brand-700 hover:to-amber-700 text-white rounded-xl shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            {isGeneratingAI ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin text-xs" aria-hidden="true" />
                <span>Menganalisis AI...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-wand-magic-sparkles text-xs text-amber-200" aria-hidden="true" />
                <span>Analisis Gemini AI</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Overall Score */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Skor Keseluruhan
            </span>
            <span className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-star" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif font-extrabold text-3xl text-stone-900">
              {analytics?.avg_overall_rating ? analytics.avg_overall_rating.toFixed(1) : '—'}
            </span>
            <span className="text-xs font-semibold text-stone-400">/ 5.0</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
            <span>Total Ulasan</span>
            <span className="font-bold text-stone-800 font-mono">
              {analytics?.total_reviews ?? 0} ulasan
            </span>
          </div>
        </div>

        {/* Resto Rating */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Rating Resto
            </span>
            <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-store" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif font-extrabold text-3xl text-stone-900">
              {analytics?.avg_resto_rating ? analytics.avg_resto_rating.toFixed(1) : '—'}
            </span>
            <span className="text-xs font-semibold text-stone-400">/ 5.0</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
            <span>Kualitas Makanan</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
              {analytics?.positive_count ?? 0} Positif
            </span>
          </div>
        </div>

        {/* App Rating */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Rating Aplikasi
            </span>
            <span className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-mobile-screen" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif font-extrabold text-3xl text-stone-900">
              {analytics?.avg_app_rating ? analytics.avg_app_rating.toFixed(1) : '—'}
            </span>
            <span className="text-xs font-semibold text-stone-400">/ 5.0</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
            <span>Aplikasi & Bayar</span>
            <span className="font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px]">
              {analytics?.avg_app_rating && analytics.avg_app_rating >= 4.5 ? 'Sangat Lancar' : 'Cukup Baik'}
            </span>
          </div>
        </div>

        {/* Satisfaction Rate */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
              Kepuasan Pelanggan
            </span>
            <span className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center text-sm">
              <i className="fa-solid fa-heart" aria-hidden="true" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-serif font-extrabold text-3xl text-stone-900">
              {analytics?.satisfaction_rate ? `${analytics.satisfaction_rate}%` : '—'}
            </span>
            <span className="text-xs font-semibold text-emerald-600">Puas (★ 4-5)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
            <span>Evaluasi (★ 1-3)</span>
            <span className="font-bold text-stone-700 font-mono">
              {analytics?.constructive_count ?? 0} ulasan
            </span>
          </div>
        </div>
      </div>

      {/* GEMINI AI SUMMARY & ACTIONABLE INSIGHTS SECTION */}
      {(isGeneratingAI || aiCustomResult || aiError) && (
        <div className="bg-gradient-to-br from-amber-950 via-stone-900 to-stone-950 text-white p-6 rounded-3xl shadow-xl border border-amber-500/30 relative overflow-hidden space-y-5">
          {/* Ambient Glow */}
          <div
            className="absolute -right-16 -top-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-stone-800">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-brand-500 text-stone-950 flex items-center justify-center text-lg shadow-md shrink-0">
                <i className="fa-solid fa-wand-magic-sparkles" aria-hidden="true" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-serif font-bold text-base text-amber-100">
                    AI Feedback Summary & Action Plan
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    Google Gemini
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Sintesis otomatis ulasan pelanggan dan rekomendasi perbaikan instan untuk dapur & resto.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-200 text-xs font-bold transition-all flex items-center gap-2 self-start sm:self-auto border border-stone-700"
            >
              <i className={`fa-solid fa-arrows-rotate ${isGeneratingAI ? 'fa-spin' : ''}`} aria-hidden="true" />
              <span>Analisis Ulang</span>
            </button>
          </div>

          {/* Loading state */}
          {isGeneratingAI && (
            <div className="py-8 flex flex-col items-center justify-center gap-3 text-stone-300">
              <i className="fa-solid fa-circle-notch fa-spin text-3xl text-amber-400" aria-hidden="true" />
              <p className="text-xs font-medium animate-pulse">
                Sedang menganalisis seluruh data review dan ulasan menu dengan Google Gemini AI...
              </p>
            </div>
          )}

          {/* Error / Not configured notice */}
          {!isGeneratingAI && (aiError || (aiCustomResult && !aiCustomResult.configured)) && (
            <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 text-red-200 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <i className="fa-solid fa-circle-exclamation text-red-400" aria-hidden="true" />
                <span>Konfigurasi Gemini AI Diperlukan</span>
              </div>
              <p className="text-red-300">
                {aiError || aiCustomResult?.error || 'GEMINI_API_KEY belum disetel pada backend .env.'}
              </p>
              <p className="text-[11px] text-stone-400 mt-1">
                Dapatkan API Key gratis di <a href="https://aistudio.google.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline font-semibold">Google AI Studio</a>, lalu tambahkan <code className="bg-black/50 px-1 py-0.5 rounded text-amber-300">GEMINI_API_KEY=AIzaSy...</code> di file .env server.
              </p>
            </div>
          )}

          {/* AI Result Content */}
          {!isGeneratingAI && aiCustomResult && aiCustomResult.configured && (
            <div className="space-y-5">
              {/* Executive Summary */}
              <div className="bg-stone-900/80 p-4 rounded-2xl border border-stone-800 space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <i className="fa-solid fa-chart-pie text-xs" aria-hidden="true" />
                  Ringkasan Eksekutif (Executive Summary)
                </h3>
                <p className="text-xs text-stone-200 leading-relaxed whitespace-pre-line">
                  {aiCustomResult.executive_summary}
                </p>
              </div>

              {/* Actionable Suggestions */}
              {aiCustomResult.actionable_suggestions && aiCustomResult.actionable_suggestions.length > 0 && (
                <div className="space-y-2.5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-2">
                    <i className="fa-solid fa-bolt text-xs text-amber-400" aria-hidden="true" />
                    Rekomendasi Perbaikan Instan (Action Items)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {aiCustomResult.actionable_suggestions.map((suggestion, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex items-start gap-3 hover:bg-amber-950/60 transition-colors"
                      >
                        <span className="w-6 h-6 rounded-lg bg-amber-400 text-stone-950 font-mono font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-xs text-stone-200 font-medium leading-snug">
                          {suggestion}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detail Summary */}
              {aiCustomResult.detail_summary && (
                <div className="bg-stone-900/60 p-4 rounded-2xl border border-stone-800 space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400 flex items-center gap-2">
                    <i className="fa-solid fa-list-check text-xs" aria-hidden="true" />
                    Detail Analisis Kategori
                  </h3>
                  <div className="text-xs text-stone-300 leading-relaxed whitespace-pre-line prose prose-invert max-w-none text-left">
                    {aiCustomResult.detail_summary}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS SECTION: DISTRIBUSI & MENU RANKINGS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rating Breakdown Bars */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-chart-simple text-amber-500 text-xs" aria-hidden="true" />
            Distribusi Bintang
          </h2>

          <div className="space-y-2.5">
            {analytics?.rating_breakdown.map((row) => (
              <button
                key={row.rating}
                type="button"
                onClick={() => {
                  setRatingFilter(String(row.rating))
                  setPage(1)
                }}
                className="w-full group text-left flex items-center gap-3 p-1 rounded-xl hover:bg-stone-50 transition-colors"
              >
                <div className="flex items-center gap-1 w-12 shrink-0 text-xs font-bold text-stone-700">
                  <span>{row.rating}</span>
                  <i className="fa-solid fa-star text-amber-400 text-[10px]" aria-hidden="true" />
                </div>
                <div className="flex-1 bg-stone-100 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all duration-500 group-hover:bg-amber-500"
                    style={{ width: `${Math.max(row.percentage, 0)}%` }}
                  />
                </div>
                <div className="w-16 text-right shrink-0 text-xs font-mono">
                  <span className="font-bold text-stone-800">{row.count}</span>
                  <span className="text-stone-400 text-[10px] ml-1">({row.percentage}%)</span>
                </div>
              </button>
            ))}
          </div>

          {/* Common Tags Chips */}
          {analytics?.common_tags && analytics.common_tags.length > 0 && (
            <div className="pt-4 border-t border-stone-100 space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Alasan Paling Sering Muncul
              </span>
              <div className="flex flex-wrap gap-1.5">
                {analytics.common_tags.map((tag) => (
                  <span
                    key={tag.tag}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border flex items-center gap-1 ${
                      tag.is_positive
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <i
                      className={`fa-solid ${tag.is_positive ? 'fa-thumbs-up text-[9px]' : 'fa-triangle-exclamation text-[9px]'}`}
                      aria-hidden="true"
                    />
                    <span>{tag.tag}</span>
                    <span className="font-mono text-[9px] font-bold opacity-75">({tag.count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Top Menu Items */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-crown text-amber-500 text-xs" aria-hidden="true" />
              Menu Terfavorit (Top Rated)
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Paling Disukai
            </span>
          </div>

          {analytics?.top_menu_items && analytics.top_menu_items.length > 0 ? (
            <div className="space-y-3">
              {analytics.top_menu_items.map((item, idx) => (
                <div key={item.item_name} className="p-3 rounded-2xl bg-stone-50 border border-stone-200/70 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-800 flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 font-mono font-bold text-[10px] flex items-center justify-center">
                        {idx + 1}
                      </span>
                      {item.item_name}
                    </span>
                    <span className="font-mono font-bold text-amber-600 flex items-center gap-1">
                      <i className="fa-solid fa-star text-[10px]" aria-hidden="true" />
                      {item.avg_rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500 pt-1">
                    <span>{item.total_reviews} ulasan menu</span>
                    <span className="text-emerald-700 font-semibold">{item.positive_count} ulasan positif</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-stone-400 py-6 text-center">Belum ada ulasan per menu.</p>
          )}
        </div>

        {/* Menu Items Needing Attention (Instant Improvements) */}
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-rose-500 text-xs" aria-hidden="true" />
              Menu Perlu Perbaikan
            </h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
              Perhatian Dapur
            </span>
          </div>

          {analytics?.needs_attention_items && analytics.needs_attention_items.length > 0 ? (
            <div className="space-y-3">
              {analytics.needs_attention_items.map((item) => (
                <div
                  key={item.item_name}
                  className="p-3 rounded-2xl bg-rose-50/40 border border-rose-200 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-stone-900">{item.item_name}</span>
                    <span className="font-mono font-bold text-rose-700 flex items-center gap-1">
                      <i className="fa-solid fa-star text-[10px]" aria-hidden="true" />
                      {item.avg_rating.toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-stone-500">
                    <span>{item.total_reviews} ulasan total</span>
                    <span className="text-rose-700 font-semibold">{item.negative_count} keluhan/evaluasi</span>
                  </div>
                  {item.sample_reasons && item.sample_reasons.length > 0 && (
                    <div className="text-[11px] text-rose-900 bg-white/80 p-2 rounded-xl border border-rose-100 italic">
                      &ldquo;{item.sample_reasons[0]}&rdquo;
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center space-y-1 text-stone-500">
              <i className="fa-solid fa-circle-check text-2xl text-emerald-500" aria-hidden="true" />
              <p className="text-xs font-medium">Luar biasa! Tidak ada menu dengan rating rendah.</p>
            </div>
          )}
        </div>
      </div>

      {/* OUTLET COMPARISON CARDS (FOR OWNER) */}
      {isOwner && analytics?.branch_summaries && analytics.branch_summaries.length > 1 && (
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-xs space-y-4">
          <h2 className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">
            <i className="fa-solid fa-building text-brand-600 text-xs" aria-hidden="true" />
            Perbandingan Antar Cabang
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {analytics.branch_summaries.map((b) => (
              <div
                key={b.branch_id}
                className="p-4 rounded-2xl bg-stone-50 border border-stone-200 flex flex-col justify-between gap-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-stone-900">{b.branch_name}</span>
                    <span className="font-mono text-[11px] font-bold text-amber-600 flex items-center gap-1">
                      <i className="fa-solid fa-star text-[10px]" aria-hidden="true" />
                      {b.avg_overall_rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 mt-0.5">{b.total_reviews} total review</p>
                </div>
                <div className="pt-2 border-t border-stone-200/60 flex items-center justify-between text-[11px] text-stone-600">
                  <span>Rating Resto: <strong>{b.avg_resto_rating.toFixed(1)}</strong></span>
                  <span>Rating App: <strong>{b.avg_app_rating.toFixed(1)}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* REVIEW DATA TABLE SECTION */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xs overflow-hidden space-y-4 p-5">
        {/* Table Filters Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div>
            <h2 className="font-serif font-bold text-sm text-stone-900">
              Daftar Ulasan Masuk
            </h2>
            <p className="text-xs text-stone-500">
              Ulasan pesanan lengkap dengan perincian item menu, resto, dan aplikasi.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <i
                className="fa-solid fa-magnifying-glass text-xs text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setPage(1)
                }}
                placeholder="Cari order, nama, ulasan..."
                className="pl-8 pr-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-brand-500 text-stone-800 w-48 sm:w-56"
              />
            </div>

            {/* Rating Filter */}
            <select
              value={ratingFilter}
              onChange={(e) => {
                setRatingFilter(e.target.value)
                setPage(1)
              }}
              aria-label="Filter berdasarkan rating bintang"
              className="px-3 py-2 text-xs font-semibold bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:border-brand-500 text-stone-700"
            >
              <option value="">Semua Rating</option>
              <option value="5">Bintang 5 ⭐⭐⭐⭐⭐</option>
              <option value="4">Bintang 4 ⭐⭐⭐⭐</option>
              <option value="3">Bintang 3 ⭐⭐⭐</option>
              <option value="2">Bintang 2 ⭐⭐</option>
              <option value="1">Bintang 1 ⭐</option>
            </select>

            {(ratingFilter || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setRatingFilter('')
                  setSearchQuery('')
                  setPage(1)
                }}
                className="px-2.5 py-2 text-xs text-rose-600 hover:bg-rose-50 rounded-xl font-bold transition-colors"
                title="Reset Filter"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Table / List */}
        {listLoading ? (
          <div className="py-16 text-center text-stone-400 space-y-2">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-brand-600" aria-hidden="true" />
            <p className="text-xs">Memuat daftar ulasan...</p>
          </div>
        ) : !feedbackList || feedbackList.items.length === 0 ? (
          <div className="py-16 text-center text-stone-400 space-y-2">
            <i className="fa-solid fa-inbox text-3xl text-stone-300" aria-hidden="true" />
            <p className="text-xs font-medium">Belum ada ulasan yang sesuai filter saat ini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-200/80 text-stone-500 font-bold uppercase text-[10px] tracking-wider bg-stone-50/60">
                  <th className="py-3 px-3">Waktu & Order</th>
                  <th className="py-3 px-3">Cabang</th>
                  <th className="py-3 px-3">Pelanggan</th>
                  <th className="py-3 px-3">Resto</th>
                  <th className="py-3 px-3">Menu Dinilai</th>
                  <th className="py-3 px-3">Aplikasi</th>
                  <th className="py-3 px-3">Catatan / Saran</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {feedbackList.items.map((fb) => (
                  <tr key={fb.order_id} className="hover:bg-stone-50/70 transition-colors">
                    {/* Waktu & Order */}
                    <td className="py-3.5 px-3">
                      <div className="font-mono font-bold text-stone-900">{fb.order_number}</div>
                      <div className="text-[11px] text-stone-400">
                        {new Date(fb.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Cabang */}
                    <td className="py-3.5 px-3">
                      <span className="font-semibold text-stone-800 text-[11px] bg-stone-100 px-2 py-0.5 rounded-md">
                        {fb.branch_name}
                      </span>
                    </td>

                    {/* Pelanggan */}
                    <td className="py-3.5 px-3">
                      <div className="font-bold text-stone-800">{fb.customer_name}</div>
                      <a
                        href={formatWhatsAppLink(fb.customer_phone, fb.customer_name, fb.order_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-emerald-600 hover:text-emerald-700 font-mono flex items-center gap-1 mt-0.5"
                        title="Chat WhatsApp Pelanggan"
                      >
                        <i className="fa-brands fa-whatsapp text-xs" aria-hidden="true" />
                        {fb.customer_phone}
                      </a>
                    </td>

                    {/* Resto Rating & Reason */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-1">
                        {renderStars(fb.resto_rating ?? fb.rating)}
                        <span className="font-bold text-stone-700 font-mono ml-0.5">
                          {fb.resto_rating ?? fb.rating}
                        </span>
                      </div>
                      {fb.resto_reason && (
                        <p className="text-[11px] text-stone-600 italic line-clamp-1 max-w-xs mt-0.5">
                          &ldquo;{fb.resto_reason}&rdquo;
                        </p>
                      )}
                    </td>

                    {/* Menu items summary */}
                    <td className="py-3.5 px-3">
                      {fb.items_feedback && fb.items_feedback.length > 0 ? (
                        <div className="space-y-1">
                          {fb.items_feedback.slice(0, 2).map((it) => (
                            <div key={it.order_item_id || it.item_name} className="flex items-center gap-1.5 text-[11px]">
                              <span className="font-semibold text-stone-700 truncate max-w-[120px]">
                                {it.item_name}
                              </span>
                              <span className="text-amber-500 font-bold flex items-center text-[10px]">
                                <i className="fa-solid fa-star text-[9px] mr-0.5" aria-hidden="true" />
                                {it.rating}
                              </span>
                            </div>
                          ))}
                          {fb.items_feedback.length > 2 && (
                            <span className="text-[10px] text-stone-400 block font-medium">
                              +{fb.items_feedback.length - 2} menu lainnya
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400">—</span>
                      )}
                    </td>

                    {/* App Rating & Reason */}
                    <td className="py-3.5 px-3">
                      {fb.app_rating ? (
                        <div>
                          <div className="flex items-center gap-1">
                            {renderStars(fb.app_rating)}
                            <span className="font-bold text-stone-700 font-mono ml-0.5">
                              {fb.app_rating}
                            </span>
                          </div>
                          {fb.app_reason && (
                            <p className="text-[11px] text-stone-600 italic line-clamp-1 max-w-xs mt-0.5">
                              &ldquo;{fb.app_reason}&rdquo;
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-stone-400">—</span>
                      )}
                    </td>

                    {/* Freeform Comment */}
                    <td className="py-3.5 px-3 max-w-xs">
                      {fb.comment ? (
                        <p className="text-stone-700 line-clamp-2 italic">
                          &ldquo;{fb.comment}&rdquo;
                        </p>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => setDetailItem(fb)}
                        className="px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs transition-colors"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {feedbackList && feedbackList.total_pages > 1 && (
          <div className="flex items-center justify-between pt-3 border-t border-stone-100 text-xs text-stone-500">
            <span>
              Menampilkan {((page - 1) * limit) + 1} - {Math.min(page * limit, feedbackList.total)} dari {feedbackList.total} ulasan
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 font-bold"
              >
                Sebelumnya
              </button>
              <span className="px-2 font-mono font-bold text-stone-700">
                {page} / {feedbackList.total_pages}
              </span>
              <button
                type="button"
                disabled={page >= feedbackList.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 disabled:opacity-40 font-bold"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {detailItem && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setDetailItem(null)}
          role="presentation"
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 overflow-y-auto max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-extrabold text-sm text-brand-700">
                    Order #{detailItem.order_number}
                  </span>
                  <span className="text-[11px] font-semibold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-md">
                    {detailItem.branch_name}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">
                  Diberikan pada {new Date(detailItem.created_at).toLocaleString('id-ID')}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center text-sm"
                aria-label="Tutup modal"
              >
                <i className="fa-solid fa-xmark" aria-hidden="true" />
              </button>
            </div>

            {/* Customer Info */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase text-stone-400 block">Pemesan</span>
                <span className="font-bold text-xs text-stone-900">{detailItem.customer_name}</span>
              </div>
              <a
                href={formatWhatsAppLink(detailItem.customer_phone, detailItem.customer_name, detailItem.order_number)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors"
              >
                <i className="fa-brands fa-whatsapp" aria-hidden="true" />
                <span>Chat WhatsApp</span>
              </a>
            </div>

            {/* Resto Rating Details */}
            <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-store text-brand-600" aria-hidden="true" />
                  Rating Restoran & Makanan
                </span>
                <span className="font-mono font-bold text-amber-600 flex items-center gap-1">
                  {renderStars(detailItem.resto_rating ?? detailItem.rating)}
                  <span>({detailItem.resto_rating ?? detailItem.rating} / 5)</span>
                </span>
              </div>
              {detailItem.resto_reason ? (
                <p className="text-xs text-stone-700 italic pl-5">
                  &ldquo;{detailItem.resto_reason}&rdquo;
                </p>
              ) : (
                <p className="text-[11px] text-stone-400 pl-5">Tidak ada catatan alasan khusus.</p>
              )}
            </div>

            {/* Menu Items Details */}
            {detailItem.items_feedback && detailItem.items_feedback.length > 0 && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-2.5">
                <span className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                  <i className="fa-solid fa-utensils text-amber-600" aria-hidden="true" />
                  Rincian Penilaian Menu ({detailItem.items_feedback.length} menu)
                </span>
                <div className="space-y-2 divide-y divide-stone-200/70">
                  {detailItem.items_feedback.map((it: OrderItemFeedback) => (
                    <div key={it.order_item_id || it.item_name} className="pt-2 first:pt-0 space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-stone-800">{it.item_name}</span>
                        <span className="text-amber-500 font-bold flex items-center gap-1">
                          {renderStars(it.rating)}
                          <span className="font-mono text-stone-700 font-bold text-[11px]">{it.rating}/5</span>
                        </span>
                      </div>
                      {it.reason && (
                        <p className="text-[11px] text-stone-600 italic">
                          &ldquo;{it.reason}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* App Rating Details */}
            {detailItem.app_rating && (
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-stone-900 flex items-center gap-1.5">
                    <i className="fa-solid fa-mobile-screen text-indigo-600" aria-hidden="true" />
                    Rating Pengalaman Aplikasi
                  </span>
                  <span className="font-mono font-bold text-indigo-600 flex items-center gap-1">
                    {renderStars(detailItem.app_rating)}
                    <span>({detailItem.app_rating} / 5)</span>
                  </span>
                </div>
                {detailItem.app_reason ? (
                  <p className="text-xs text-stone-700 italic pl-5">
                    &ldquo;{detailItem.app_reason}&rdquo;
                  </p>
                ) : (
                  <p className="text-[11px] text-stone-400 pl-5">Tidak ada catatan alasan khusus.</p>
                )}
              </div>
            )}

            {/* Extra Comment */}
            {detailItem.comment && (
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200 space-y-1">
                <span className="text-xs font-bold text-stone-700 block">Komentar Tambahan Pelanggan:</span>
                <p className="text-xs text-stone-800 italic bg-white p-3 rounded-xl border border-stone-200/80">
                  &ldquo;{detailItem.comment}&rdquo;
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="w-full py-3 bg-stone-800 hover:bg-stone-900 text-white font-bold rounded-2xl text-xs transition-colors"
            >
              Tutup Rincian
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default FeedbackPage
