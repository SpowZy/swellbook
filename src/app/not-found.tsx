import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-16 pt-20 text-center sm:px-6">
      <p className="font-display text-6xl font-semibold text-ocean">404</p>
      <h1 className="mt-3 font-display text-2xl font-semibold">That page drifted away.</h1>
      <p className="mt-2 text-ink-soft">
        The stay, booking or dashboard you are looking for does not exist here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-coral px-5 py-2.5 font-semibold text-white hover:bg-coral-deep"
      >
        Back to the good stuff
      </Link>
    </div>
  );
}
