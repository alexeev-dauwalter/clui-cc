import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XIcon, MagnifyingGlassIcon, SpinnerGapIcon, ArrowClockwiseIcon, HeadCircuitIcon, CompassIcon, GithubLogoIcon } from '@phosphor-icons/react'
import { useSessionStore } from '../stores/sessionStore'
import { useColors } from '../theme'
import type { CatalogPlugin, PluginStatus } from '../../shared/types'

export function MarketplacePanel() {
  const colors = useColors()
  const catalog = useSessionStore((s) => s.marketplaceCatalog)
  const loading = useSessionStore((s) => s.marketplaceLoading)
  const error = useSessionStore((s) => s.marketplaceError)
  const pluginStates = useSessionStore((s) => s.marketplacePluginStates)
  const search = useSessionStore((s) => s.marketplaceSearch)
  const filter = useSessionStore((s) => s.marketplaceFilter)
  const closeMarketplace = useSessionStore((s) => s.closeMarketplace)
  const setSearch = useSessionStore((s) => s.setMarketplaceSearch)
  const setFilter = useSessionStore((s) => s.setMarketplaceFilter)
  const loadMarketplace = useSessionStore((s) => s.loadMarketplace)
  const buildYourOwn = useSessionStore((s) => s.buildYourOwn)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Derive filter chips dynamically from catalog semantic tags, sorted by frequency
  const filters = useMemo(() => {
    const tagCounts = new Map<string, number>()
    for (const p of catalog) {
      for (const t of (p.tags || [])) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1)
      }
    }
    // Sort by frequency (descending), then alphabetically
    const sorted = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag]) => tag)
    return ['All', ...sorted, 'Installed']
  }, [catalog])

  // Debounced search
  const [localSearch, setLocalSearch] = useState(search)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setLocalSearch(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setSearch(val), 200)
  }, [setSearch])

  useEffect(() => () => clearTimeout(debounceRef.current), [])

  // Filtered plugins
  const lowerSearch = localSearch.toLowerCase()
  const filtered = useMemo(() => {
    return catalog.filter((p) => {
      const pluginName = (p.name || '').toLowerCase()
      const pluginDescription = (p.description || '').toLowerCase()
      const pluginTags = Array.isArray(p.tags) ? p.tags : []
      const matchesSearch = !lowerSearch ||
        pluginName.includes(lowerSearch) ||
        pluginDescription.includes(lowerSearch) ||
        pluginTags.some((t) => String(t).toLowerCase().includes(lowerSearch)) ||
        (p.author || '').toLowerCase().includes(lowerSearch) ||
        (p.repo || '').toLowerCase().includes(lowerSearch) ||
        (p.marketplace || '').toLowerCase().includes(lowerSearch)
      const matchesFilter =
        filter === 'All' ||
        (filter === 'Installed' && pluginStates[p.id] === 'installed') ||
        pluginTags.includes(filter)
      return matchesSearch && matchesFilter
    })
  }, [catalog, lowerSearch, filter, pluginStates])

  // Reorder cards so expanded card sits on a full-width row with no grid gaps.
  // If the expanded card was in the right column (odd index), its left neighbor
  // drops below it to fill the next row — no empty cells.
  const displayOrder = useMemo(() => {
    if (expandedId === null) return filtered
    const idx = filtered.findIndex((p) => p.id === expandedId)
    if (idx === -1) return filtered
    const expanded = filtered[idx]
    const before = filtered.slice(0, idx)
    const after = filtered.slice(idx + 1)
    if (idx % 2 === 1 && before.length > 0) {
      // Odd index (right column): move left neighbor to after the expanded card
      const leftNeighbor = before.pop()!
      return [...before, expanded, leftNeighbor, ...after]
    }
    return [...before, expanded, ...after]
  }, [filtered, expandedId])

  return (
    <div
      data-orbiter-ui
      className="h-[470px] flex flex-col"
    >
      {/* Header */}
      <div className="border-b border-container-border flex items-center justify-between px-[18px] pt-4 pb-2.5">
        <div className="flex items-center gap-2">
          <HeadCircuitIcon size={20} weight="regular" className="text-accent" />
          <div>
            <div className="text-text-primary text-[13px] font-bold">
              Skills Marketplace
            </div>
            <div className="text-text-tertiary text-[11px] mt-0.5">
              Install skills and plugins without leaving Orbiter
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-text-tertiary text-[11px]">
            {filtered.length} result{filtered.length === 1 ? '' : 's'}
          </span>
          <button
            onClick={() => loadMarketplace(true)}
            className="bg-none border-none cursor-pointer text-text-tertiary hover:text-text-primary p-0.5 flex rounded transition-colors"
            title="Refresh marketplace"
          >
            <ArrowClockwiseIcon size={14} />
          </button>
          <button
            onClick={closeMarketplace}
            className="bg-none border-none cursor-pointer text-text-tertiary hover:text-text-primary p-0.5 flex rounded transition-colors"
          >
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Search + Build your own */}
      <div className="px-[18px] pt-3 pb-2.5 flex gap-2 items-center">
        <div className="bg-input-pill-bg border border-container-border flex items-center gap-1.5 rounded-xl px-3 py-[9px] min-w-0 flex-1">
          <MagnifyingGlassIcon size={13} className="text-text-tertiary shrink-0" />
          <input
            type="text"
            placeholder="Search skills, tags, authors..."
            value={localSearch}
            onChange={handleSearchChange}
            className="text-text-primary flex-1 bg-transparent border-none outline-none text-[12px] font-[inherit]"
          />
        </div>
        <button
          onClick={buildYourOwn}
          className="shrink-0 h-9 px-3 rounded-full cursor-pointer inline-flex items-center gap-1.5 transition-colors text-accent bg-accent-light text-[11px] font-semibold font-[inherit] whitespace-nowrap hover:border-accent border border-dashed border-accent-border-medium"
        >
          <CompassIcon size={12} weight="regular" />
          Build your own
        </button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 px-[18px] pb-3 overflow-x-auto" style={{
        scrollbarWidth: 'none',
      }}>
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`transition-all border cursor-pointer text-[11px] font-semibold px-[11px] py-1.5 rounded-full font-[inherit] whitespace-nowrap ${filter === f ? 'text-accent bg-accent-light border-accent' : 'text-text-secondary bg-transparent border-container-border'}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Body */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-[18px]" style={{ scrollbarWidth: 'thin' }}>
        {loading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState error={error} onRetry={() => loadMarketplace(true)} />
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="flex flex-wrap gap-2.5 pb-1.5">
            {displayOrder.map((plugin) => (
              <PluginCard
                key={plugin.id}
                plugin={plugin}
                status={pluginStates[plugin.id] || 'not_installed'}
                colors={colors}
                expanded={expandedId === plugin.id}
                scrollContainerRef={scrollContainerRef}
                onToggleExpand={() => {
                  setExpandedId(expandedId === plugin.id ? null : plugin.id)
                }}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

// ─── PluginCard ───

function PluginCard({ plugin, status, colors, expanded, onToggleExpand, scrollContainerRef }: {
  plugin: CatalogPlugin
  status: PluginStatus
  colors: ReturnType<typeof useColors>
  expanded: boolean
  onToggleExpand: () => void
  scrollContainerRef: React.RefObject<HTMLDivElement | null>
}) {
  const [showConfirm, setShowConfirm] = useState(false)
  const installPlugin = useSessionStore((s) => s.installMarketplacePlugin)
  const uninstallPlugin = useSessionStore((s) => s.uninstallMarketplacePlugin)
  const cardRef = useRef<HTMLDivElement>(null)
  const needsScrollRef = useRef(false)

  useEffect(() => {
    if (expanded) needsScrollRef.current = true
  }, [expanded])

  const handleLayoutComplete = useCallback(() => {
    if (!needsScrollRef.current || !expanded || !cardRef.current || !scrollContainerRef.current) return
    needsScrollRef.current = false
    const container = scrollContainerRef.current
    const card = cardRef.current
    const containerRect = container.getBoundingClientRect()
    const cardRect = card.getBoundingClientRect()
    // Scroll so the card is vertically centered in the scroll container
    const cardTopRelative = cardRect.top - containerRect.top + container.scrollTop
    const targetScroll = cardTopRelative - (containerRect.height - cardRect.height) / 2
    container.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' })
  }, [expanded, scrollContainerRef])

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (status === 'failed') {
      installPlugin(plugin)
    } else {
      setShowConfirm(true)
      if (!expanded) onToggleExpand()
    }
  }

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirm(false)
    installPlugin(plugin)
  }

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowConfirm(false)
  }

  const handleGithubClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    const url = `https://github.com/${plugin.repo || 'unknown/repo'}/tree/main/${plugin.sourcePath || ''}`
    window.orbiter.openExternal(url)
  }

  // Collapse → clear confirm
  useEffect(() => {
    if (!expanded) setShowConfirm(false)
  }, [expanded])

  const safeName = plugin.name || 'Unnamed plugin'
  const safeDescription = plugin.description || 'No description provided.'
  const safeCategory = plugin.category || 'Other'
  const safeMarketplace = plugin.marketplace || 'Marketplace'
  const safeAuthor = plugin.author || 'Unknown'
  const safeRepo = plugin.repo || 'unknown/repo'
  const safeVersion = plugin.version || 'n/a'

  const githubButton = (
    <button
      onClick={handleGithubClick}
      className="bg-transparent border-none cursor-pointer p-0.5 flex rounded transition-colors text-text-tertiary hover:text-text-primary"
      title="View source on GitHub"
    >
      <GithubLogoIcon size={14} />
    </button>
  )

  return (
    <motion.div
      ref={cardRef}
      layout
      transition={{ duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
      onLayoutAnimationComplete={handleLayoutComplete}
      onClick={onToggleExpand}
      className="p-3 rounded-[14px] cursor-pointer"
      style={{
        border: `1px solid ${expanded ? colors.surfaceSecondary : colors.containerBorder}`,
        background: expanded ? colors.surfaceActive : colors.surfaceHover,
        minHeight: expanded ? undefined : 154,
        width: expanded ? '100%' : 'calc(50% - 5px)',
      }}
      onMouseEnter={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = colors.surfaceActive
          e.currentTarget.style.borderColor = colors.surfaceSecondary
        }
      }}
      onMouseLeave={(e) => {
        if (!expanded) {
          e.currentTarget.style.background = colors.surfaceHover
          e.currentTarget.style.borderColor = colors.containerBorder
        }
      }}
    >
      {expanded ? (
        /* ── Expanded: full-width single column ── */
        <div>
          {/* Header row: tags + actions */}
          <div className="flex items-start justify-between gap-2.5 mb-2">
            <div className="flex flex-wrap gap-1.5">
              <Tag label={safeCategory} emphasis="accent" />
              {(plugin.tags || []).map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              {githubButton}
              <StatusButton status={status} onClick={handleInstallClick} onUninstall={(e) => { e.stopPropagation(); uninstallPlugin(plugin) }} />
            </div>
          </div>

          <div className="text-text-primary text-[13px] font-semibold">
            {safeName}
          </div>
          <div className="text-text-secondary text-[11px] mt-[5px] leading-normal">
            {safeDescription}
          </div>
          <div className="text-text-tertiary text-[10px] mt-2">
            {safeRepo} · by {safeAuthor} · v{safeVersion}
          </div>

          {/* Confirm panel or installing status */}
          {showConfirm && status === 'not_installed' && (
            <div className="bg-surface-primary border border-container-border px-3 py-2.5 rounded-[10px] mt-2.5">
              <div className="text-text-tertiary text-[10px] mb-1">
                {plugin.isSkillMd ? 'Will install to:' : 'Will run:'}
              </div>
              <div className="text-text-secondary bg-code-bg text-[10px] font-mono px-1.5 py-1 rounded leading-[1.6]">
                {plugin.isSkillMd
                  ? <>~/.claude/skills/{plugin.installName}/SKILL.md</>
                  : <>claude plugin install {plugin.installName}@{safeMarketplace}</>
                }
              </div>
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={handleConfirm}
                  className="bg-accent text-text-on-accent text-[10px] font-semibold px-2.5 py-1 rounded-md border-none cursor-pointer font-[inherit]"
                >
                  Confirm Install
                </button>
                <button
                  onClick={handleCancel}
                  className="text-text-secondary border border-container-border text-[10px] font-medium px-2.5 py-1 rounded-md bg-transparent cursor-pointer font-[inherit]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {status === 'installing' && (
            <div className="bg-surface-primary border border-container-border px-3 py-2.5 rounded-[10px] mt-2.5 flex items-center gap-2">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="flex"
              >
                <SpinnerGapIcon size={14} className="text-accent" />
              </motion.div>
              <span className="text-text-secondary text-[11px]">Installing plugin...</span>
            </div>
          )}
        </div>
      ) : (
        /* ── Collapsed: original layout ── */
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap gap-1.5 mb-2">
              <Tag label={safeCategory} emphasis="accent" />
              {(plugin.tags || []).slice(0, 2).map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
            <div className="text-text-primary text-[13px] font-semibold">
              {safeName}
            </div>
            <div className="text-text-secondary text-[11px] mt-[5px] leading-[1.45] line-clamp-3">
              {safeDescription}
            </div>
            <div className="text-text-tertiary text-[10px] mt-2">
              {safeRepo} · by {safeAuthor} · v{safeVersion}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            {githubButton}
            <StatusButton status={status} onClick={handleInstallClick} onUninstall={(e) => { e.stopPropagation(); uninstallPlugin(plugin) }} />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── StatusButton ───

function StatusButton({ status, onClick, onUninstall }: {
  status: PluginStatus
  onClick: (e: React.MouseEvent) => void
  onUninstall?: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  switch (status) {
    case 'installed':
      return (
        <button
          onClick={onUninstall}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className={`transition-all text-[10px] font-medium px-2 py-0.5 rounded-lg whitespace-nowrap border-none cursor-pointer font-[inherit] ${hovered ? 'bg-status-error-bg text-status-error' : 'bg-status-complete-bg text-status-complete'}`}
        >
          {hovered ? 'Uninstall' : 'Installed'}
        </button>
      )
    case 'installing':
      return (
        <span className="bg-accent-light text-accent text-[10px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1 whitespace-nowrap">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="flex"
          >
            <SpinnerGapIcon size={10} />
          </motion.div>
          Installing...
        </span>
      )
    case 'failed':
      return (
        <button
          onClick={onClick}
          className="bg-status-error-bg text-status-error text-[10px] font-medium px-2 py-0.5 rounded-lg border-none cursor-pointer font-[inherit] whitespace-nowrap"
        >
          Failed — Retry
        </button>
      )
    default:
      return (
        <button
          onClick={onClick}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-accent-light text-accent cursor-pointer font-[inherit] whitespace-nowrap transition-colors hover:bg-accent-soft border border-accent-border"
        >
          Install
        </button>
      )
  }
}

function Tag({ label, emphasis }: {
  label: string
  emphasis?: 'accent'
}) {
  const isAccent = emphasis === 'accent'
  return (
    <span
      className={`border text-[10px] font-semibold leading-none px-2 py-[5px] rounded-full whitespace-nowrap ${isAccent ? 'bg-accent-light text-accent border-accent-border-medium' : 'bg-surface-primary text-text-secondary border-container-border'}`}
    >
      {label}
    </span>
  )
}

// ─── States ───

function LoadingState() {
  return (
    <div className="flex flex-col gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <div key={i} className="px-2.5 py-2">
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 }}
            className="bg-surface-primary h-3 w-[60%] rounded mb-1"
          />
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.15 + 0.1 }}
            className="bg-surface-primary h-2.5 w-[90%] rounded"
          />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ error, onRetry }: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="px-2.5 py-5 text-center">
      <div className="text-status-error text-[11px] mb-2">
        {error.length > 100 ? error.substring(0, 100) + '...' : error}
      </div>
      <button
        onClick={onRetry}
        className="bg-accent-light text-accent border border-accent-border text-[10px] font-semibold px-3 py-1 rounded-md cursor-pointer font-[inherit] inline-flex items-center gap-1"
      >
        <ArrowClockwiseIcon size={11} /> Retry
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="text-text-tertiary px-2.5 py-6 text-center text-[11px]">
      No plugins match your search
    </div>
  )
}
