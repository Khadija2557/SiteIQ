import { useState } from "react";
import { useLocation } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { Tractor } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export default function Login() {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "admin@acme-construction.com",
      password: "Admin123!",
    },
  });

  function onSubmit(values: z.infer<typeof loginSchema>) {
    loginMutation.mutate({
      data: {
        email: values.email,
        password: values.password,
      }
    }, {
      onSuccess: (data) => {
        localStorage.setItem("token", data.token);
        axios.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
        setLocation("/");
      },
      onError: () => {
        toast({
          title: "Login failed",
          description: "Please check your credentials.",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-background dark p-4 font-mono">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center text-center">
          <div className="h-12 w-12 bg-primary text-primary-foreground rounded flex items-center justify-center mb-4">
            <Tractor className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold tracking-tighter text-primary">SITE<span className="text-foreground">IQ</span></h1>
          <p className="text-muted-foreground mt-2 tracking-widest uppercase text-xs">Command Center Authorization</p>
        </div>

        <div className="bg-card border border-border p-6 rounded-md">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>OPERATOR ID (EMAIL)</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter email" {...field} className="bg-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>PASSCODE</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="Enter passcode" {...field} className="bg-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full font-bold tracking-wider" disabled={loginMutation.isPending}>
                {loginMutation.isPending ? "AUTHENTICATING..." : "INITIATE LINK"}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}