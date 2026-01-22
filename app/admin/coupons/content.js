"use client";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Badge } from "../../components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Switch } from "../../components/ui/switch";
import {
  Ticket,
  Plus,
  Search,
  Loader2,
  Pencil,
  Trash2,
  Copy,
  CheckCircle,
  XCircle,
  Calendar,
  Percent,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";
import { useAdminCoupons } from "./context";

export default function AdminCouponsContent() {
  const {
    data,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    isCreateOpen,
    setIsCreateOpen,
    editingCoupon,
    setEditingCoupon,
    formData,
    setFormData,
    resetForm,
    handleEdit,
    handleSubmit,
    createMutation,
    updateMutation,
    deleteMutation,
  } = useAdminCoupons();

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Coupon code copied!");
  };

  const getStatusBadge = (coupon) => {
    if (!coupon.is_active) {
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Inactive
        </Badge>
      );
    }
    if (coupon.end_date && new Date(coupon.end_date) < new Date()) {
      return (
        <Badge variant="destructive">
          <Calendar className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    }
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return (
        <Badge variant="secondary">
          <XCircle className="h-3 w-3 mr-1" />
          Used Up
        </Badge>
      );
    }
    return (
      <Badge className="bg-emerald-100 text-emerald-700">
        <CheckCircle className="h-3 w-3 mr-1" />
        Active
      </Badge>
    );
  };

  const coupons = data?.coupons || [];

  return (
    <div className="p-6 space-y-6" data-testid="admin-coupons-page">
      <div className="flex items-center justify-between" data-testid="admin-coupons-header">
        <div data-testid="admin-coupons-header-content">
          <h1
            className="text-2xl font-bold flex items-center gap-2"
            data-testid="admin-coupons-title"
          >
            <Ticket className="h-6 w-6" data-testid="admin-coupons-title-icon" />
            Coupon Codes
          </h1>
          <p className="text-muted-foreground" data-testid="admin-coupons-description">
            Manage discount coupons for the marketplace
          </p>
        </div>
        <Dialog
          open={isCreateOpen || !!editingCoupon}
          onOpenChange={(open) => {
            if (!open) {
              setIsCreateOpen(false);
              setEditingCoupon(null);
              resetForm();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              onClick={() => setIsCreateOpen(true)}
              data-testid="admin-coupons-create"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Coupon
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" data-testid="admin-coupons-dialog">
            <DialogHeader>
              <DialogTitle data-testid="admin-coupons-dialog-title">
                {editingCoupon ? "Edit Coupon" : "Create New Coupon"}
              </DialogTitle>
              <DialogDescription data-testid="admin-coupons-dialog-description">
                {editingCoupon
                  ? "Update the coupon details below"
                  : "Fill in the details to create a new coupon"}
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="space-y-4"
              data-testid="admin-coupons-form"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="code">Coupon Code *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="e.g., SAVE20"
                    required
                    data-testid="admin-coupons-code"
                  />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="e.g., 20% off your first purchase"
                    data-testid="admin-coupons-description"
                  />
                </div>
                <div>
                  <Label htmlFor="discount_type">Discount Type *</Label>
                  <Select
                    value={formData.discount_type}
                    onValueChange={(v) =>
                      setFormData({ ...formData, discount_type: v })
                    }
                  >
                    <SelectTrigger data-testid="admin-coupons-discount-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                      <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="discount_value">Discount Value *</Label>
                  <Input
                    id="discount_value"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.discount_value}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        discount_value: e.target.value,
                      })
                    }
                    placeholder={
                      formData.discount_type === "percentage"
                        ? "e.g., 20"
                        : "e.g., 10.00"
                    }
                    required
                    data-testid="admin-coupons-discount-value"
                  />
                </div>
                <div>
                  <Label htmlFor="min_order_amount">Min Order Amount</Label>
                  <Input
                    id="min_order_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.min_order_amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        min_order_amount: e.target.value,
                      })
                    }
                    placeholder="e.g., 50.00"
                    data-testid="admin-coupons-min-order"
                  />
                </div>
                <div>
                  <Label htmlFor="max_discount_amount">Max Discount</Label>
                  <Input
                    id="max_discount_amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.max_discount_amount}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        max_discount_amount: e.target.value,
                      })
                    }
                    placeholder="e.g., 100.00"
                    data-testid="admin-coupons-max-discount"
                  />
                </div>
                <div>
                  <Label htmlFor="usage_limit">Usage Limit</Label>
                  <Input
                    id="usage_limit"
                    type="number"
                    min="0"
                    value={formData.usage_limit}
                    onChange={(e) =>
                      setFormData({ ...formData, usage_limit: e.target.value })
                    }
                    placeholder="Unlimited if empty"
                    data-testid="admin-coupons-usage-limit"
                  />
                </div>
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) =>
                      setFormData({ ...formData, start_date: e.target.value })
                    }
                    data-testid="admin-coupons-start-date"
                  />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) =>
                      setFormData({ ...formData, end_date: e.target.value })
                    }
                    data-testid="admin-coupons-end-date"
                  />
                </div>
                <div className="col-span-2 flex items-center justify-between">
                  <Label htmlFor="is_active">Active</Label>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, is_active: checked })
                    }
                    data-testid="admin-coupons-active"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingCoupon(null);
                    resetForm();
                  }}
                  data-testid="admin-coupons-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    createMutation.isPending || updateMutation.isPending
                  }
                  data-testid="admin-coupons-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingCoupon ? "Update" : "Create"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card data-testid="admin-coupons-filters">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4" data-testid="admin-coupons-filters-row">
            <div className="flex-1 relative" data-testid="admin-coupons-search-wrapper">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                data-testid="admin-coupons-search-icon"
              />
              <Input
                placeholder="Search coupons..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
                data-testid="admin-coupons-search"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40" data-testid="admin-coupons-status">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Coupons Table */}
      <Card data-testid="admin-coupons-table-card">
        <CardContent className="p-0" data-testid="admin-coupons-table-content">
          {isLoading ? (
            <div
              className="flex items-center justify-center py-12"
              data-testid="admin-coupons-loading"
            >
              <Loader2
                className="h-8 w-8 animate-spin text-muted-foreground"
                data-testid="admin-coupons-loading-spinner"
              />
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-12" data-testid="admin-coupons-empty">
              <Ticket className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No coupons found</p>
              <Button
                className="mt-4"
                onClick={() => setIsCreateOpen(true)}
                data-testid="admin-coupons-empty-create"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create your first coupon
              </Button>
            </div>
          ) : (
            <Table data-testid="admin-coupons-table">
              <TableHeader data-testid="admin-coupons-head">
                <TableRow data-testid="admin-coupons-head-row">
                  <TableHead data-testid="admin-coupons-head-code">Code</TableHead>
                  <TableHead data-testid="admin-coupons-head-discount">Discount</TableHead>
                  <TableHead data-testid="admin-coupons-head-usage">Usage</TableHead>
                  <TableHead data-testid="admin-coupons-head-period">Valid Period</TableHead>
                  <TableHead data-testid="admin-coupons-head-status">Status</TableHead>
                  <TableHead className="text-right" data-testid="admin-coupons-head-actions">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody data-testid="admin-coupons-body">
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id} data-testid={`admin-coupon-row-${coupon.id}`}>
                    <TableCell data-testid={`admin-coupon-row-${coupon.id}-code`}>
                      <div className="flex items-center gap-2">
                        <code
                          className="bg-muted px-2 py-1 rounded font-mono text-sm"
                          data-testid={`admin-coupon-row-${coupon.id}-code-value`}
                        >
                          {coupon.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyCode(coupon.code)}
                          data-testid={`admin-coupon-copy-${coupon.id}`}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {coupon.description && (
                        <p
                          className="text-xs text-muted-foreground mt-1"
                          data-testid={`admin-coupon-row-${coupon.id}-description`}
                        >
                          {coupon.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell data-testid={`admin-coupon-row-${coupon.id}-discount`}>
                      <div className="flex items-center gap-1">
                        {coupon.discount_type === "percentage" ? (
                          <>
                            <span data-testid={`admin-coupon-row-${coupon.id}-discount-percent`}>
                              {coupon.discount_value}%
                            </span>
                          </>
                        ) : (
                          <>
                            <DollarSign
                              className="h-4 w-4 text-muted-foreground"
                              data-testid={`admin-coupon-row-${coupon.id}-discount-icon`}
                            />
                            <span data-testid={`admin-coupon-row-${coupon.id}-discount-amount`}>
                              ${parseFloat(coupon.discount_value).toFixed(2)}
                            </span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`admin-coupon-row-${coupon.id}-usage`}>
                      <span data-testid={`admin-coupon-row-${coupon.id}-usage-count`}>
                        {coupon.usage_count || 0}
                      </span>
                      {coupon.usage_limit && (
                        <span
                          className="text-muted-foreground"
                          data-testid={`admin-coupon-row-${coupon.id}-usage-limit`}
                        >
                          {" "}
                          / {coupon.usage_limit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell data-testid={`admin-coupon-row-${coupon.id}-period`}>
                      <div className="text-sm">
                        {coupon.start_date && (
                          <div data-testid={`admin-coupon-row-${coupon.id}-start-date`}>
                            From:{" "}
                            {new Date(coupon.start_date).toLocaleDateString(
                              "en-US",
                              { timeZone: "UTC" }
                            )}
                          </div>
                        )}
                        {coupon.end_date && (
                          <div data-testid={`admin-coupon-row-${coupon.id}-end-date`}>
                            To:{" "}
                            {new Date(coupon.end_date).toLocaleDateString(
                              "en-US",
                              { timeZone: "UTC" }
                            )}
                          </div>
                        )}
                        {!coupon.start_date && !coupon.end_date && (
                          <span
                            className="text-muted-foreground"
                            data-testid={`admin-coupon-row-${coupon.id}-no-period`}
                          >
                            No limit
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`admin-coupon-row-${coupon.id}-status`}>
                      <span data-testid={`admin-coupon-row-${coupon.id}-status-badge`}>
                        {getStatusBadge(coupon)}
                      </span>
                    </TableCell>
                    <TableCell
                      className="text-right"
                      data-testid={`admin-coupon-row-${coupon.id}-actions`}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(coupon)}
                          data-testid={`admin-coupon-edit-${coupon.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to delete this coupon?"
                              )
                            ) {
                              deleteMutation.mutate(coupon.id);
                            }
                          }}
                          data-testid={`admin-coupon-delete-${coupon.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

