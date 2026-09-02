import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";
import SelectionDrawer, { type PaymentMethod } from "@/components/product/SelectionDrawer";
import {
  useCart,
  cartItemCount,
  setQuantity,
  shouldUseFullPageCart,
  formatMoney,
} from "@/lib/cart";

/**
 * Global header cart entry point.
 *
 * Icon is always visible; the count badge only renders when the cart holds
 * something. Routing mirrors the product-page controller: a single line opens
 * the mini-cart drawer, 2+ lines go straight to the full-page /cart layout.
 */
export default function CartNavButton({
  className,
  iconClassName,
}: {
  className?: string;
  iconClassName?: string;
}) {
  const navigate = useNavigate();
  const items = useCart();
  const count = cartItemCount(items);
  const [open, setOpen] = useState(false);

  const handleClick = () => {
    if (items.length === 0) {
      navigate("/cart");
      return;
    }
    // Always show the full selection in the drawer — every line, with its own
    // stepper. The full-page cart stays available via "View Full Cart".
    setOpen(true);
  };

  const handleQuantity = (key: string, q: number) => {
    setQuantity(key, q);
  };


  const handleCheckout = (method: PaymentMethod) => {
    if (method === "wire") {
      try {
        sessionStorage.setItem("ma_checkout_wire", "1");
      } catch {
        /* private mode — falls back to the online flow */
      }
    }
    setOpen(false);
    // Always hand the current cart to /checkout explicitly: without router
    // state the page would fall back to a stale "ma_checkout_line" entry left
    // behind by an earlier direct Place Order and charge the wrong product.
    navigate("/checkout", {
      state: {
        lines: items.map((i) => ({
          title: i.title,
          designer: i.designerName,
          finishLabel: i.finishLabel,
          imageUrl: i.imageUrl,
          unitCents: i.unitPriceCents,
          currency: i.currency,
          leadTime: i.leadTime,
          productPath:
            i.designerSlug && i.productSlug
              ? `/designers/${i.designerSlug}/${i.productSlug}`
              : null,
          quantity: i.quantity,
        })),
      },
    });
  };

  return (
    <>
      <button
        onClick={handleClick}
        aria-label={count > 0 ? `Your selection, ${count} item${count > 1 ? "s" : ""}` : "Your selection"}
        className={cn("relative p-1 transition-colors hover:text-foreground", className)}
      >
        <ShoppingBag className={cn("w-[16px] h-[16px] text-muted-foreground", iconClassName)} strokeWidth={1.25} />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] leading-none px-1">
            {count}
          </span>
        )}
      </button>

      <SelectionDrawer
        isOpen={open && items.length > 0}
        onClose={() => setOpen(false)}
        lines={items.map((i) => ({
          key: i.key,
          brand: i.designerName,
          title: i.title,
          configuration: i.finishLabel,
          leadTime: i.leadTime,
          imageUrl: i.imageUrl,
          quantity: i.quantity,
          priceLabel:
            i.unitPriceCents > 0
              ? formatMoney(i.unitPriceCents * i.quantity, i.currency)
              : "Price upon Request",
        }))}
        subtotalLabel={
          items.some((i) => i.unitPriceCents > 0)
            ? formatMoney(cartSubtotalCents(items), items[0]?.currency)
            : null
        }
        onLineQuantityChange={handleQuantity}
        onRemoveLine={(key) => removeFromCart(key)}
        onViewCart={() => {
          setOpen(false);
          navigate("/cart");
        }}
        onCheckout={handleCheckout}
      />

    </>
  );
}
