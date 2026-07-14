import { HostWizard } from "@/components/HostWizard";

export default function NewListingPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-16 sm:px-6">
      <section className="pt-10">
        <h1 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Put your place on the map<span className="text-coral">.</span>
        </h1>
        <p className="mt-2 text-ink-soft">
          Four short steps. Most hosts are live and bookable in under ten minutes.
        </p>
      </section>
      <section className="mt-6">
        <HostWizard />
      </section>
    </div>
  );
}
