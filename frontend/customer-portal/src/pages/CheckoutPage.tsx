import Header from '../components/Header';
import Footer from '../components/Footer';

export default function CheckoutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Checkout</h1>
        <p>Checkout process</p>
      </main>
      <Footer />
    </div>
  );
}
