'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getOrganization } from '@/app/actions/organization'

export interface OrganizationData {
  id: string
  name: string
  logo_url: string | null
  phone?: string | null
  email?: string | null
  address?: string | null
  // FBR / invoice settings (DB columns added by fbr-radars-setup.sql; null until the SQL is run)
  ntn?: string | null
  fbr_token?: string | null
  barcode_value?: string | null
  invoice_prefix?: string | null
  created_at?: string
}

interface OrganizationContextType {
  organization: OrganizationData | null
  updateLogo: (newLogoUrl: string | null) => void
  updateOrganizationState: (updated: Partial<OrganizationData>) => void
  refreshOrganization: () => Promise<void>
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({
  children,
  initialOrganization,
}: {
  children: React.ReactNode
  initialOrganization: OrganizationData | null
}) {
  const [organization, setOrganization] = useState<OrganizationData | null>(initialOrganization)

  // Keep state synced if server initial value changes
  useEffect(() => {
    if (initialOrganization) {
      setOrganization((prev) => {
        // Only update if something changed to avoid unnecessary renders
        if (!prev || prev.id !== initialOrganization.id || prev.logo_url !== initialOrganization.logo_url || prev.name !== initialOrganization.name) {
          return initialOrganization
        }
        return prev
      })
    }
  }, [initialOrganization])

  // Broadcast & update logo in-memory immediately
  const updateLogo = useCallback((newLogoUrl: string | null) => {
    setOrganization((prev) => {
      const updated = prev ? { ...prev, logo_url: newLogoUrl } : ({ id: 'org', name: 'Qurbat ERP', logo_url: newLogoUrl } as OrganizationData)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('qurbat-organization-updated', { detail: updated })
        )
      }
      return updated
    })
  }, [])

  // Broadcast & update organization details in-memory immediately
  const updateOrganizationState = useCallback((updated: Partial<OrganizationData>) => {
    setOrganization((prev) => {
      const next = prev ? { ...prev, ...updated } : (updated as OrganizationData)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('qurbat-organization-updated', { detail: next })
        )
      }
      return next
    })
  }, [])

  const refreshOrganization = useCallback(async () => {
    try {
      const res = await getOrganization()
      if (res.organization) {
        setOrganization(res.organization)
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('qurbat-organization-updated', { detail: res.organization })
          )
        }
      }
    } catch (e) {
      console.error('Error refreshing organization data:', e)
    }
  }, [])

  // Listen to cross-component live sync events
  useEffect(() => {
    const handleSync = (event: Event) => {
      const customEvent = event as CustomEvent<OrganizationData>
      if (customEvent.detail) {
        setOrganization((prev) => ({
          ...(prev || {}),
          ...customEvent.detail,
        }))
      }
    }

    window.addEventListener('qurbat-organization-updated', handleSync)
    return () => {
      window.removeEventListener('qurbat-organization-updated', handleSync)
    }
  }, [])

  return (
    <OrganizationContext.Provider
      value={{
        organization,
        updateLogo,
        updateOrganizationState,
        refreshOrganization,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (!context) {
    return {
      organization: null,
      updateLogo: () => {},
      updateOrganizationState: () => {},
      refreshOrganization: async () => {},
    }
  }
  return context
}
