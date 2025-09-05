import Image from "next/image";
import Link from "next/link";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardFooter } from "../components/ui/card";
import { Download, Star } from "lucide-react";

export default function GridCard({ resource }) {
  return (
    <Card className="h-full flex flex-col hover:shadow-md transition-shadow">
      <div className="relative aspect-square overflow-hidden">
        <Image
          src={resource.image || "/placeholder.svg"}
          alt={resource.title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          priority
        />
        {resource.featured && (
          <Badge className="absolute top-2 left-2 text-xs bg-orange-500">
            Featured
          </Badge>
        )}
      </div>

      <CardContent className="flex-1 p-4">
        <Link href={`/product/${resource.id}`}>
          <h3 className="font-semibold text-blue-600 hover:underline cursor-pointer line-clamp-1">
            {resource.title}
          </h3>
        </Link>

        <Link
          href={`/author/${resource.author.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <div className="text-xs text-green-600 mt-1 mb-2 hover:underline cursor-pointer">
            {resource.author}
          </div>
        </Link>

        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {resource.description}
        </p>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span>{resource.rating}</span>
          </div>
          <div className="flex items-center gap-1">
            <Download className="h-3 w-3" />
            <span>{resource.downloads.toLocaleString()}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 mt-2">
          {resource.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        <div className="text-lg font-bold">${resource.price}</div>
        <Button size="sm">Add</Button>
      </CardFooter>
    </Card>
  );
}
