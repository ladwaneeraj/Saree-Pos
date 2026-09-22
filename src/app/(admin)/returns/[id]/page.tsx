"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

/** Deep link to a return: opens it in the returns drawer. */
export default function ReturnRedirect() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/returns?open=${id}`);
  }, [id, router]);
  return null;
}
