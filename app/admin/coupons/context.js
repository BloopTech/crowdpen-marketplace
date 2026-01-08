"use client";

import React, { createContext, useContext, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const AdminCouponsContext = createContext(null);

const emptyForm = () => ({
  code: "",
  description: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  max_discount_amount: "",
  usage_limit: "",
  start_date: "",
  end_date: "",
  is_active: true,
});

export function AdminCouponsProvider({ children }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const resetForm = () => {
    setFormData(emptyForm());
  };

  const couponsQuery = useQuery({
    queryKey: ["admin", "coupons", search, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter);
      const res = await fetch(`/api/admin/coupons?${params.toString()}`);
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message);
      return json;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast.success("Coupon created successfully");
      setIsCreateOpen(false);
      resetForm();
      queryClient.invalidateQueries(["admin", "coupons"]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to create coupon");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast.success("Coupon updated successfully");
      setEditingCoupon(null);
      resetForm();
      queryClient.invalidateQueries(["admin", "coupons"]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to update coupon");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/admin/coupons/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.status !== "success") throw new Error(json.message);
      return json;
    },
    onSuccess: () => {
      toast.success("Coupon deleted successfully");
      queryClient.invalidateQueries(["admin", "coupons"]);
    },
    onError: (err) => {
      toast.error(err.message || "Failed to delete coupon");
    },
  });

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code || "",
      description: coupon.description || "",
      discount_type: coupon.discount_type || "percentage",
      discount_value: coupon.discount_value?.toString() || "",
      min_order_amount: coupon.min_order_amount?.toString() || "",
      max_discount_amount: coupon.max_discount_amount?.toString() || "",
      usage_limit: coupon.usage_limit?.toString() || "",
      start_date: coupon.start_date
        ? new Date(coupon.start_date).toISOString().slice(0, 10)
        : "",
      end_date: coupon.end_date
        ? new Date(coupon.end_date).toISOString().slice(0, 10)
        : "",
      is_active: coupon.is_active,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingCoupon) {
      updateMutation.mutate({ id: editingCoupon.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const value = {
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
    data: couponsQuery.data,
    isLoading: couponsQuery.isFetching || couponsQuery.isLoading,
  };

  return (
    <AdminCouponsContext.Provider value={value}>
      {children}
    </AdminCouponsContext.Provider>
  );
}

export function useAdminCoupons() {
  const ctx = useContext(AdminCouponsContext);
  if (!ctx) {
    throw new Error("useAdminCoupons must be used inside AdminCouponsProvider");
  }
  return ctx;
}
