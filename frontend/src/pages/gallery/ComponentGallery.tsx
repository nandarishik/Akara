import { useState } from "react"

import { AdminDrawer } from "@/components/admin/AdminDrawer"
import { AdminTable } from "@/components/admin/AdminTable"
import { ConfirmDialog } from "@/components/admin/ConfirmDialog"
import { Badge, PlanBadge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  KPICard,
  LockedCard,
  PlanCard,
} from "@/components/ui/card"
import {
  CardListSkeleton,
  ChartSkeleton,
  ChatSkeleton,
  KPICardSkeleton,
  PageHeaderSkeleton,
  Skeleton,
  TableSkeleton,
} from "@/components/ui/skeleton"
import { toast } from "@/components/ui/toast"

const DEMO_ROWS = [
  { id: "1", name: "Sharma Traders", plan: "pro", status: "active" },
  { id: "2", name: "Kumar Dist.", plan: "business", status: "past_due" },
]

export default function ComponentGallery() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <div className="min-h-screen bg-surface-bg p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        <header>
          <h1 className="text-3xl font-bold text-text-primary">
            AKARA Component Gallery
          </h1>
          <p className="mt-2 text-text-secondary">
            Dev-only preview of Phase 2 Day 1 design system primitives.
          </p>
        </header>

        {/* Buttons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary CTA</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
            <Button variant="default">Default</Button>
            <Button variant="primary" loading>
              Loading
            </Button>
            <Button variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge variant="plan-free">Free</Badge>
            <Badge variant="plan-pro">Pro ✦</Badge>
            <Badge variant="plan-business">Business ✦✦</Badge>
            <Badge variant="status-active">Active</Badge>
            <Badge variant="status-trialing">Trialing</Badge>
            <Badge variant="status-past_due">Past Due</Badge>
            <Badge variant="status-cancelled">Cancelled</Badge>
            <Badge variant="change-positive">↑ 12%</Badge>
            <Badge variant="change-negative">↓ 8%</Badge>
            <Badge variant="change-neutral">→ 0%</Badge>
          </div>
          <div>
            <PlanBadge plan="pro" status="active" showStatus />
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Cards</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <KPICard
              label="Revenue"
              value="₹18.4L"
              change="↑ 12%"
              changeVariant="positive"
              accent="amber"
            />
            <KPICard
              label="Orders"
              value="1,247"
              change="↓ 3%"
              changeVariant="negative"
              accent="brand"
            />
            <KPICard label="Loading" value="" loading accent="success" />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <PlanCard
              name="Free"
              price="₹0"
              features={["10 questions/mo", "CSV upload"]}
              cta={
                <Button variant="outline" className="w-full">
                  Current plan
                </Button>
              }
            />
            <PlanCard
              name="Pro"
              price="₹7,999"
              popular
              features={["400 questions/mo", "WhatsApp briefs"]}
              cta={
                <Button variant="primary" className="w-full">
                  Upgrade
                </Button>
              }
            />
            <LockedCard title="Simulator" description="Pro feature" />
          </div>

          <Card className="card-hover max-w-md">
            <CardHeader>
              <CardTitle>Base Card</CardTitle>
              <CardDescription>
                Standard shadcn card with AKARA tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-text-secondary">
                Hover for card-hover lift effect.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Skeletons */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Skeletons
          </h2>
          <PageHeaderSkeleton />
          <KPICardSkeleton />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartSkeleton />
            <ChatSkeleton />
          </div>
          <TableSkeleton rows={3} cols={3} />
          <CardListSkeleton count={2} />
          <Skeleton className="h-8 w-48" />
        </section>

        {/* Toasts */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">Toasts</h2>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="secondary"
              onClick={() => toast.success("Import complete — 4,010 rows added")}
            >
              Success
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                toast.error("Import failed", {
                  description: "No valid date column found.",
                })
              }
            >
              Error
            </Button>
            <Button
              variant="outline"
              onClick={() => toast.warning("9/10 questions used this month")}
            >
              Warning
            </Button>
            <Button
              variant="ghost"
              onClick={() => toast.info("Weekly brief sent to WhatsApp")}
            >
              Info
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const id = toast.loading("Importing your data…")
                setTimeout(() => {
                  toast.dismiss(id)
                  toast.success("Import complete!")
                }, 2000)
              }}
            >
              Loading → Success
            </Button>
          </div>
        </section>

        {/* Admin primitives */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-text-primary">
            Admin (dark surface)
          </h2>
          <div className="superadmin-surface rounded-xl p-6 space-y-4">
            <AdminTable
              columns={[
                { key: "name", header: "Tenant" },
                {
                  key: "plan",
                  header: "Plan",
                  render: (row) => (
                    <PlanBadge plan={row.plan as "pro"} />
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge
                      variant={`status-${row.status}` as "status-active"}
                    >
                      {row.status}
                    </Badge>
                  ),
                },
              ]}
              data={DEMO_ROWS}
              keyExtractor={(row) => row.id}
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setDrawerOpen(true)}
              >
                Open drawer
              </Button>
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
              >
                Open confirm dialog
              </Button>
            </div>
          </div>
        </section>
      </div>

      <AdminDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Tenant details"
        description="Preview drawer for superadmin panels."
      >
        <p className="text-sm text-sa-muted">
          Drawer body content scrolls independently.
        </p>
      </AdminDrawer>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete tenant data?"
        description="This action cannot be undone. All sales data for this tenant will be permanently removed."
        confirmLabel="Delete permanently"
        impactPreview={
          <ul className="list-inside list-disc space-y-1 text-sa-muted">
            <li>4,010 sales rows will be deleted</li>
            <li>12 import history records removed</li>
            <li>3 active users will lose access</li>
          </ul>
        }
        onConfirm={() => {
          toast.success("Action confirmed (demo)")
          setConfirmOpen(false)
        }}
      />
    </div>
  )
}
