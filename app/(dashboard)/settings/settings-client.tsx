'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  updateOrganization, 
  uploadOrganizationLogo, 
  updateOrganizationLogoUrl, 
  removeOrganizationLogo 
} from '@/app/actions/organization'
import { useOrganization } from '@/components/providers/organization-provider'
import { 
  Sun, 
  Moon, 
  Laptop, 
  Check, 
  Palette, 
  Building2, 
  Store, 
  Pencil, 
  Loader2, 
  Phone, 
  Mail, 
  MapPin, 
  AlertCircle, 
  CheckCircle2,
  Upload,
  Image as ImageIcon,
  Trash2,
  Link2,
  Sparkles,
  X,
  FileImage
} from 'lucide-react'

export function SettingsClient({ 
  organization: initialOrg, 
  isOwner = false 
}: { 
  organization: any; 
  isOwner?: boolean 
}) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { organization: contextOrg, updateLogo, updateOrganizationState } = useOrganization()
  
  // Organization state derived from context or props
  const organization = contextOrg || initialOrg

  const [mounted, setMounted] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [pending, setPending] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null)

  // Logo upload & management state
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [uploadPending, setUploadPending] = React.useState(false)
  const [removePending, setRemovePending] = React.useState(false)
  const [urlPending, setUrlPending] = React.useState(false)
  const [logoError, setLogoError] = React.useState<string | null>(null)
  const [logoSuccess, setLogoSuccess] = React.useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = React.useState(false)
  const [customLogoUrl, setCustomLogoUrl] = React.useState('')
  const [isDragging, setIsDragging] = React.useState(false)

  const fileInputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  // Clean up object preview URL on unmount or file change
  React.useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [previewUrl])

  async function optimizeImageForUpload(file: File): Promise<File> {
    if (typeof window === 'undefined') return file
    if (file.type === 'image/svg+xml' || file.type === 'image/gif' || file.size < 600 * 1024) {
      return file
    }

    return new Promise((resolve) => {
      const img = new Image()
      const reader = new FileReader()
      reader.onload = (e) => {
        img.src = e.target?.result as string
      }
      img.onload = () => {
        const maxDim = 1200
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width)
            width = maxDim
          } else {
            width = Math.round((width * maxDim) / height)
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (!blob || blob.size >= file.size) {
              resolve(file)
            } else {
              const baseName = file.name.replace(/\.[^/.]+$/, '')
              const optimizedFile = new File([blob], `${baseName}.webp`, {
                type: 'image/webp',
                lastModified: Date.now(),
              })
              resolve(optimizedFile)
            }
          },
          'image/webp',
          0.92
        )
      }
      img.onerror = () => resolve(file)
      reader.readAsDataURL(file)
    })
  }

  async function handleFileSelect(file: File) {
    setLogoError(null)
    setLogoSuccess(null)

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      setLogoError('Unsupported file type. Please choose a PNG, JPG, WEBP, SVG, or GIF.')
      return
    }

    // 10MB safety check
    if (file.size > 10 * 1024 * 1024) {
      setLogoError('Image size exceeds 10MB. Please choose a smaller image.')
      return
    }

    const processedFile = await optimizeImageForUpload(file)
    setSelectedFile(processedFile)
    const localUrl = URL.createObjectURL(processedFile)
    setPreviewUrl(localUrl)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0])
    }
  }

  function handleCancelPreview() {
    setSelectedFile(null)
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl)
    }
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function handleUploadLogo() {
    if (!selectedFile) return

    setUploadPending(true)
    setLogoError(null)
    setLogoSuccess(null)

    try {
      const formData = new FormData()
      formData.append('logo', selectedFile)

      const res = await uploadOrganizationLogo(formData)
      setUploadPending(false)

      if (res?.error) {
        setLogoError(res.error)
      } else if (res?.success) {
        // Instantly update global context and local state
        updateLogo(res.logo_url)
        if (res.organization) {
          updateOrganizationState(res.organization)
        }
        setLogoSuccess('Logo uploaded and applied everywhere instantly!')
        handleCancelPreview()
      }
    } catch (err: any) {
      setUploadPending(false)
      const msg = err?.message || ''
      if (msg.includes('Body exceeded') || msg.includes('limit')) {
        setLogoError('Image payload exceeded server limit. Please upload an image under 5MB.')
      } else {
        setLogoError(msg || 'Failed to upload logo. Please try again.')
      }
    }
  }

  async function handleRemoveLogo() {
    setRemovePending(true)
    setLogoError(null)
    setLogoSuccess(null)

    try {
      const res = await removeOrganizationLogo()
      setRemovePending(false)

      if (res?.error) {
        setLogoError(res.error)
      } else if (res?.success) {
        // Instantly clear logo in context
        updateLogo(null)
        if (res.organization) {
          updateOrganizationState(res.organization)
        }
        setLogoSuccess('Logo removed. Default store branding restored everywhere.')
      }
    } catch (err: any) {
      setRemovePending(false)
      setLogoError(err?.message || 'Failed to remove logo. Please try again.')
    }
  }

  async function handleSaveUrl(e: React.FormEvent) {
    e.preventDefault()
    if (!customLogoUrl.trim()) return

    setUrlPending(true)
    setLogoError(null)
    setLogoSuccess(null)

    try {
      const res = await updateOrganizationLogoUrl(customLogoUrl.trim())
      setUrlPending(false)

      if (res?.error) {
        setLogoError(res.error)
      } else if (res?.success) {
        updateLogo(res.logo_url)
        if (res.organization) {
          updateOrganizationState(res.organization)
        }
        setLogoSuccess('Logo URL applied and updated everywhere instantly!')
        setShowUrlInput(false)
        setCustomLogoUrl('')
      }
    } catch (err: any) {
      setUrlPending(false)
      setLogoError(err?.message || 'Failed to save logo URL. Please try again.')
    }
  }

  async function handleUpdateOrg(formData: FormData) {
    setPending(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const res = await updateOrganization(formData)
      setPending(false)

      if (res?.error) {
        setErrorMessage(res.error)
      } else if (res?.success) {
        setSuccessMessage('Organization information updated successfully.')
        if (res.organization) {
          updateOrganizationState(res.organization)
        }
        setOpen(false)
      }
    } catch (err: any) {
      setPending(false)
      setErrorMessage(err?.message || 'Failed to update organization details.')
    }
  }

  const activeLogo = previewUrl || organization?.logo_url

  return (
    <div className="space-y-6">
      {/* Theme & Appearance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-primary" />
            <CardTitle>Appearance & Theme</CardTitle>
          </div>
          <CardDescription>
            Customize how Qurbat ERP looks on your device. Choose between light, dark, or system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Light Mode Card */}
            <div
              onClick={() => setTheme('light')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'light'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-slate-100 border border-slate-200 p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-300 rounded" />
                    <div className="h-2 w-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-slate-400 rounded" />
                    <div className="h-2 w-20 bg-slate-200 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span className="font-semibold text-sm">Light Mode</span>
                  </div>
                  {mounted && theme === 'light' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Dark Mode Card */}
            <div
              onClick={() => setTheme('dark')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'dark'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-zinc-900 border border-zinc-700 p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-zinc-700 rounded" />
                    <div className="h-2 w-4 bg-zinc-700 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-zinc-500 rounded" />
                    <div className="h-2 w-20 bg-zinc-800 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Moon className="h-4 w-4 text-emerald-400" />
                    <span className="font-semibold text-sm">Dark Mode</span>
                  </div>
                  {mounted && theme === 'dark' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* System Preference Card */}
            <div
              onClick={() => setTheme('system')}
              className={`group relative flex flex-col items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${
                mounted && theme === 'system'
                  ? 'border-primary bg-primary/5 shadow-md'
                  : 'border-border/60 hover:border-border hover:bg-muted/30'
              }`}
            >
              <div className="w-full space-y-2">
                <div className="h-20 w-full rounded-lg bg-gradient-to-r from-slate-100 to-zinc-900 border border-border p-2.5 flex flex-col justify-between shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="h-2 w-12 bg-slate-400 rounded" />
                    <div className="h-2 w-4 bg-slate-300 rounded-full" />
                  </div>
                  <div className="space-y-1">
                    <div className="h-2 w-16 bg-slate-500 rounded" />
                    <div className="h-2 w-20 bg-zinc-600 rounded" />
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Laptop className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-sm">System Theme</span>
                  </div>
                  {mounted && theme === 'system' && (
                    <Badge variant="default" className="text-[10px] h-5 px-1.5">
                      <Check className="h-3 w-3 mr-0.5" /> Active
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-muted/50 border flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Currently active appearance</p>
              <p className="text-xs text-muted-foreground">
                {mounted ? (
                  <>
                    Rendering in <strong className="capitalize">{resolvedTheme}</strong> mode (preference:{' '}
                    <strong className="capitalize">{theme}</strong>)
                  </>
                ) : (
                  'Synchronizing theme...'
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={mounted && theme === 'light' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('light')}
              >
                <Sun className="h-3.5 w-3.5 mr-1 text-amber-500" />
                Light
              </Button>
              <Button
                variant={mounted && theme === 'dark' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('dark')}
              >
                <Moon className="h-3.5 w-3.5 mr-1 text-emerald-400" />
                Dark
              </Button>
              <Button
                variant={mounted && theme === 'system' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTheme('system')}
              >
                <Laptop className="h-3.5 w-3.5 mr-1" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Branding & Dynamic Logo Management */}
      <Card className="overflow-hidden border-primary/20">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-muted/20 border-b">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>Business Branding & Dynamic Logo</CardTitle>
            </div>
            <CardDescription className="mt-1">
              Upload your business's official logo. When changed, it updates across the entire system instantly—including the sidebar, POS receipts, and invoices.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isOwner ? (
              <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-700 text-[11px] gap-1 py-1">
                <Check className="h-3 w-3" /> Owner Managed
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-xs text-muted-foreground font-normal">
                Read-Only (Owner Controlled)
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {logoSuccess && (
            <div className="p-3 text-xs rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="font-medium">{logoSuccess}</span>
              </div>
              <button 
                onClick={() => setLogoSuccess(null)}
                className="text-emerald-600 hover:opacity-80 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {logoError && (
            <div className="p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20 flex items-center justify-between gap-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="font-medium">{logoError}</span>
              </div>
              <button 
                onClick={() => setLogoError(null)}
                className="text-destructive hover:opacity-80 p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Logo Preview Section */}
            <div className="lg:col-span-4 flex flex-col items-center sm:items-start space-y-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Current Brand Logo
              </Label>
              
              <div className="relative group w-44 h-44 rounded-2xl border-2 border-border/80 p-3 bg-muted/20 flex flex-col items-center justify-center shadow-xs overflow-hidden">
                {/* Subtle checkered pattern for transparency visibility */}
                <div 
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
                    backgroundSize: '12px 12px'
                  }}
                />

                {activeLogo ? (
                  <img
                    src={activeLogo}
                    alt={organization?.name || 'Business Logo'}
                    className="h-full w-full object-contain rounded-xl transition-transform group-hover:scale-105 duration-200"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-4 space-y-2 text-muted-foreground">
                    <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
                      <Store className="h-7 w-7" />
                    </div>
                    <span className="text-xs font-medium">Default Icon Active</span>
                  </div>
                )}

                {previewUrl && (
                  <div className="absolute top-2 right-2">
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-[9px] px-1.5 py-0 h-4">
                      Preview
                    </Badge>
                  </div>
                )}
              </div>

              <div className="w-full max-w-44 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Status:</span>
                  <span className="font-medium text-foreground">
                    {activeLogo ? 'Custom Logo' : 'System Store Icon'}
                  </span>
                </div>
                
                {isOwner && organization?.logo_url && !previewUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive h-8 text-xs mt-1"
                    disabled={removePending}
                    onClick={handleRemoveLogo}
                  >
                    {removePending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                    )}
                    Reset to Default Icon
                  </Button>
                )}
              </div>
            </div>

            {/* Upload Zone & Actions */}
            <div className="lg:col-span-8 space-y-4">
              {isOwner ? (
                <>
                  {/* Drag & Drop Upload Zone */}
                  <div
                    onDragOver={(e) => {
                      e.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-2xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
                      isDragging
                        ? 'border-primary bg-primary/5 scale-[0.99]'
                        : 'border-border/80 hover:border-primary/60 hover:bg-muted/30 bg-muted/10'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileSelect(e.target.files[0])
                        }
                      }}
                    />

                    <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="h-6 w-6" />
                    </div>

                    <h4 className="text-sm font-semibold text-foreground">
                      Click to upload or drag & drop business logo
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                      Supports high-resolution PNG, JPG, SVG, or WEBP (transparent background recommended, max 5MB)
                    </p>
                  </div>

                  {/* Selected File Action Bar */}
                  {selectedFile && (
                    <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in duration-200">
                      <div className="flex items-center gap-3 w-full sm:w-auto overflow-hidden">
                        <div className="h-10 w-10 rounded-lg bg-background border flex items-center justify-center shrink-0">
                          <FileImage className="h-5 w-5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(selectedFile.size / 1024).toFixed(1)} KB • Ready to save
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelPreview}
                          disabled={uploadPending}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleUploadLogo}
                          disabled={uploadPending}
                          className="h-8 text-xs"
                        >
                          {uploadPending ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1.5" />
                              Save & Apply Logo
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Direct URL Alternative Accordion/Option */}
                  <div className="pt-1">
                    {!showUrlInput ? (
                      <button
                        type="button"
                        onClick={() => setShowUrlInput(true)}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1.5 transition-colors"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Or provide an external direct image URL
                      </button>
                    ) : (
                      <form onSubmit={handleSaveUrl} className="space-y-2 p-3.5 rounded-xl border bg-muted/20">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="logoUrl" className="text-xs font-medium flex items-center gap-1.5">
                            <Link2 className="h-3.5 w-3.5 text-primary" />
                            Direct Logo Image URL
                          </Label>
                          <button
                            type="button"
                            onClick={() => setShowUrlInput(false)}
                            className="text-xs text-muted-foreground hover:text-foreground"
                          >
                            Close
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            id="logoUrl"
                            placeholder="https://example.com/images/logo.png"
                            value={customLogoUrl}
                            onChange={(e) => setCustomLogoUrl(e.target.value)}
                            className="h-8 text-xs"
                          />
                          <Button 
                            type="submit" 
                            size="sm" 
                            disabled={urlPending || !customLogoUrl.trim()} 
                            className="h-8 text-xs shrink-0"
                          >
                            {urlPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Set URL'}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-4 rounded-xl border bg-muted/20 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">Restricted to Owner</p>
                  <p>
                    Logo customization and business branding can only be modified by accounts with Owner privileges.
                  </p>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Organization Details */}
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Organization Information</CardTitle>
            </div>
            <CardDescription>
              Company settings, contact credentials, and official headquarters address.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {isOwner ? (
              <Dialog 
                open={open} 
                onOpenChange={(val) => {
                  setOpen(val)
                  if (val) {
                    setErrorMessage(null)
                    setSuccessMessage(null)
                  }
                }}
              >
                <DialogTrigger render={<Button variant="outline" size="sm" />}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" />
                  Edit Details
                </DialogTrigger>
                <DialogContent className="max-w-md sm:max-w-md">
                  <form action={handleUpdateOrg}>
                    <DialogHeader>
                      <DialogTitle>Edit Organization Information</DialogTitle>
                      <DialogDescription>
                        Update your business credentials, contact phone, and official address.
                      </DialogDescription>
                    </DialogHeader>

                    {errorMessage && (
                      <div className="my-2 p-3 text-xs rounded-md bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                    )}

                    <div className="grid gap-4 py-4">
                      <div className="grid gap-2">
                        <Label htmlFor="name">Business Name <span className="text-destructive">*</span></Label>
                        <Input
                          id="name"
                          name="name"
                          required
                          placeholder="e.g. Qurbat Business & Management"
                          defaultValue={organization?.name || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="phone">Contact Phone</Label>
                        <Input
                          id="phone"
                          name="phone"
                          type="tel"
                          placeholder="+92 (300) 123-4567"
                          defaultValue={organization?.phone || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="email">Business Email</Label>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="admin@qurbat-erp.com"
                          defaultValue={organization?.email || ''}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="address">Main Address</Label>
                        <Input
                          id="address"
                          name="address"
                          placeholder="Main Commercial Area, Sector B"
                          defaultValue={organization?.address || ''}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={pending}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={pending}>
                        {pending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <Badge variant="secondary" className="text-xs text-muted-foreground font-normal">
                Owner Managed
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {successMessage && (
            <div className="p-3 text-xs rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Business Name</span>
              <div className="font-semibold text-base flex items-center gap-2.5">
                {organization?.logo_url ? (
                  <div className="h-6 w-6 rounded-md overflow-hidden border bg-muted/20 flex items-center justify-center shrink-0">
                    <img
                      src={organization.logo_url}
                      alt="Logo"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <Store className="h-4 w-4 text-primary shrink-0" />
                )}
                <span>{organization?.name || 'Qurbat Business & Management'}</span>
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Contact Phone</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.phone || '+92 (300) 123-4567'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Business Email</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.email || 'admin@qurbat-erp.com'}
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Main Address</span>
              <p className="font-medium text-sm flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                {organization?.address || 'Main Commercial Area, Sector B'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
