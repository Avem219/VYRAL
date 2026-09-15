import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
export async function GET(){try{await db.execute(sql`select 1`);return NextResponse.json({ok:true,service:"vyral",database:"ok",time:new Date().toISOString()})}catch{return NextResponse.json({ok:false,service:"vyral",database:"error"},{status:503})}}
