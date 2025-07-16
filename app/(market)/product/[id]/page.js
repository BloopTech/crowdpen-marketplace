"use server";
import { ProductItemContextProvider } from "./context";
import ProductDetailContent from "./content";

export default async function ProductDetailPage({ params }) {
  const { id } = await params;

  return (
    <>
      <ProductItemContextProvider id={id}>
        <ProductDetailContent id={id} />
      </ProductItemContextProvider>
    </>
  );
}
