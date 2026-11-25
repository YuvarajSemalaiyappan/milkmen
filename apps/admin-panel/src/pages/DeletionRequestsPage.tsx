import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Card, Button, Badge, Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/ui'
import { deletionRequestsApi } from '@/services'
import { useAppStore } from '@/store'
import type { DeletionRequest } from '@/types'

// Account deletion requests from the apps (signed in) and the public /delete-account page.
// Nothing is deleted automatically. To handle a request:
//   Owner  -> open the business and use "Delete business", then mark the request Done.
//   Staff  -> remove the login (the owner can do it in Staff, or delete it here), then mark Done.
//   Web form -> find the business by the phone number first; the sender isn't signed in.
type Filter = 'PENDING' | 'DONE' | 'REJECTED' | 'CANCELLED' | ''

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'DONE', label: 'Done' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED', label: 'Withdrawn' },
  { value: '', label: 'All' }
]

const STATUS_BADGE: Record<DeletionRequest['status'], { variant: 'warning' | 'success' | 'danger' | 'default'; label: string }> = {
  PENDING: { variant: 'warning', label: 'Pending' },
  DONE: { variant: 'success', label: 'Done' },
  REJECTED: { variant: 'danger', label: 'Rejected' },
  CANCELLED: { variant: 'default', label: 'Withdrawn' }
}

export function DeletionRequestsPage() {
  const addToast = useAppStore((state) => state.addToast)
  const [filter, setFilter] = useState<Filter>('PENDING')
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await deletionRequestsApi.list(filter || undefined)
      setRequests(response.data)
      setPendingCount(response.pendingCount)
    } catch (err) {
      console.error('Failed to load deletion requests:', err)
      addToast({ type: 'error', message: 'Failed to load deletion requests' })
    } finally {
      setIsLoading(false)
    }
  }, [filter, addToast])

  useEffect(() => {
    load()
  }, [load])

  const setStatus = async (request: DeletionRequest, status: 'PENDING' | 'DONE' | 'REJECTED') => {
    if (status === 'DONE' && !window.confirm(`Mark the request from ${request.name} as done? Delete their data first.`)) return
    let adminNote: string | undefined
    if (status === 'REJECTED') {
      const note = window.prompt('Reason for rejecting (optional)', request.adminNote ?? '')
      if (note === null) return
      adminNote = note
    }
    setBusyId(request.id)
    try {
      await deletionRequestsApi.update(request.id, { status, adminNote })
      addToast({ type: 'success', message: 'Request updated' })
      await load()
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update request' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deletion requests</h1>
        <p className="text-gray-500 mt-1">
          {pendingCount} pending. Owners: delete the business from its page. Staff: remove the login. Then mark the request done.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            variant={filter === f.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <Card padding="none">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Requested</TableHeader>
              <TableHeader>Person</TableHeader>
              <TableHeader>Business</TableHeader>
              <TableHeader>From</TableHeader>
              <TableHeader>Reason</TableHeader>
              <TableHeader>Status</TableHeader>
              <TableHeader>Actions</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading && requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">Loading...</TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500 py-8">No requests</TableCell>
              </TableRow>
            ) : (
              requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{format(new Date(r.createdAt), 'dd MMM yyyy, h:mm a')}</TableCell>
                  <TableCell>
                    <div className="font-medium text-gray-900">{r.name}</div>
                    <div className="text-sm text-gray-500">{r.phone}{r.role ? ` · ${r.role}` : ''}</div>
                  </TableCell>
                  <TableCell>
                    {r.businessId ? (
                      <Link to={`/businesses/${r.businessId}`} className="text-blue-600 hover:underline">
                        {r.businessName || 'Open business'}
                      </Link>
                    ) : (
                      <span className="text-gray-700">{r.businessName || '-'}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.source === 'APP' ? 'info' : 'default'} size="sm">
                      {r.source === 'APP' ? 'App (signed in)' : 'Web form'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-sm text-gray-700 whitespace-pre-wrap">{r.reason || '-'}</span>
                    {r.adminNote && <div className="text-xs text-gray-500 mt-1">Note: {r.adminNote}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[r.status].variant} size="sm">{STATUS_BADGE[r.status].label}</Badge>
                    {r.handledAt && (
                      <div className="text-xs text-gray-500 mt-1">{format(new Date(r.handledAt), 'dd MMM yyyy')}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {r.status === 'PENDING' ? (
                        <>
                          <Button size="sm" isLoading={busyId === r.id} onClick={() => setStatus(r, 'DONE')}>Done</Button>
                          <Button size="sm" variant="secondary" disabled={busyId === r.id} onClick={() => setStatus(r, 'REJECTED')}>Reject</Button>
                        </>
                      ) : r.status !== 'CANCELLED' ? (
                        <Button size="sm" variant="ghost" isLoading={busyId === r.id} onClick={() => setStatus(r, 'PENDING')}>Reopen</Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
