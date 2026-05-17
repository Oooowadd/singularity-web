import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6 p-8">
      <Skeleton className="h-8 w-24" />

      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-16" />
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </section>
    </div>
  );
}
