import { PublicFolderScreen } from "@/features/folders/components/public-folder-screen";

import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";

const EXPORT_PUBLIC_ID = "route-shell";

export function generateStaticParams() {
  return [{ publicId: EXPORT_PUBLIC_ID }];
}

export default function PublicFolderRoute() {
  const { publicId } = useLocalSearchParams<{ publicId: string }>();
  return (
    <>
      <Head>
        <meta
          name="robots"
          content="noindex"
        />
      </Head>
      <PublicFolderScreen publicId={publicId} />
    </>
  );
}
