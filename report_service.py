from flask import Flask, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient
from datetime import datetime
import json

app = Flask(__name__)
CORS(app)

# Helper function to convert MongoDB documents to JSON serializable format
def convert_doc(doc):
    """Convert MongoDB document to JSON serializable format"""
    if doc is None:
        return None
    # Create a copy to avoid modifying original
    doc_copy = dict(doc)
    # Convert ObjectId to string
    if '_id' in doc_copy:
        doc_copy['_id'] = str(doc_copy['_id'])
    # Convert datetime objects to ISO format strings
    for key, value in doc_copy.items():
        if isinstance(value, datetime):
            doc_copy[key] = value.isoformat()
    return doc_copy

# MongoDB connection
MONGO_URI = 'mongodb://localhost:27017/'
DB_NAME = 'police_feedback_system'

print("=" * 60)
print("🐍 Python Report Service Starting...")
print("=" * 60)

# Initialize variables
client = None
db = None
feedback_collection = None
all_collections = []

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    
    # Test connection
    client.admin.command('ping')
    print(f"✅ Connected to MongoDB")
    print(f"📁 Database: {DB_NAME}")
    
    # List all collections
    all_collections = db.list_collection_names()
    print(f"📊 Available collections: {all_collections}")
    
    # Find the feedback collection (your model is 'FeedbackSubmission' -> 'feedbacksubmissions')
    if 'feedbacksubmissions' in all_collections:
        feedback_collection = db['feedbacksubmissions']
        count = feedback_collection.count_documents({})
        print(f"✅ Found collection 'feedbacksubmissions' with {count} documents")
    elif 'feedbacks' in all_collections:
        feedback_collection = db['feedbacks']
        count = feedback_collection.count_documents({})
        print(f"✅ Found collection 'feedbacks' with {count} documents")
    else:
        # Check any collection that might have feedback data
        for coll_name in all_collections:
            count = db[coll_name].count_documents({})
            if count > 0:
                sample = db[coll_name].find_one()
                if sample and ('station_name' in sample or 'experience_rating' in sample):
                    feedback_collection = db[coll_name]
                    print(f"✅ Found feedback data in collection '{coll_name}' with {count} documents")
                    break
    
    if feedback_collection is None:
        print("⚠️ No feedback collection found!")
        print("   Please submit some feedback through the citizen form first.")
    else:
        total = feedback_collection.count_documents({})
        print(f"📝 Total feedbacks available: {total}")
        if total > 0:
            stations = feedback_collection.distinct('station_name')
            print(f"   Stations with data: {stations}")
            ratings = feedback_collection.distinct('experience_rating')
            print(f"   Ratings present: {ratings}")
    
except Exception as e:
    print(f"❌ MongoDB Connection Error: {e}")
    feedback_collection = None

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        if feedback_collection is None:
            return jsonify({
                'status': 'error',
                'message': 'No feedback collection found. Please submit some feedback first.',
                'available_collections': all_collections
            }), 200
        
        total = feedback_collection.count_documents({})
        stations = feedback_collection.distinct('station_name') if total > 0 else []
        
        return jsonify({
            'status': 'ok',
            'service': 'python_report_service',
            'mongodb': 'connected',
            'database': DB_NAME,
            'collection': feedback_collection.name,
            'total_feedbacks': total,
            'stations': stations
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500

@app.route('/api/debug/feedbacks', methods=['GET'])
def debug_feedbacks():
    """Debug endpoint to see all feedbacks"""
    try:
        if feedback_collection is None:
            return jsonify({
                'error': 'No feedback collection found',
                'available_collections': all_collections
            }), 200
        
        total = feedback_collection.count_documents({})
        all_feedbacks = list(feedback_collection.find({}))
        
        # Convert each document to JSON serializable format
        serializable_feedbacks = [convert_doc(fb) for fb in all_feedbacks]
        
        stations = feedback_collection.distinct('station_name') if total > 0 else []
        
        return jsonify({
            'success': True,
            'total_feedbacks': total,
            'collection_name': feedback_collection.name,
            'unique_stations': stations,
            'all_feedbacks': serializable_feedbacks
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/thana-analysis', methods=['POST'])
def generate_report():
    """Generate report from feedback data"""
    try:
        if feedback_collection is None:
            return jsonify({
                'success': False,
                'error': 'No feedback collection found',
                'report': {
                    'summary': {'total_feedbacks': 0},
                    'thana_analysis': {},
                    'overall_ratings': {'average_rating': 0}
                }
            })
        
        data = request.get_json()
        date_from = data.get('date_from')
        date_to = data.get('date_to')
        selected_thana = data.get('thana')
        
        print(f"\n📊 Generating Report...")
        print(f"   Date from: {date_from}")
        print(f"   Date to: {date_to}")
        print(f"   Thana filter: {selected_thana}")
        
        # Build MongoDB query
        query = {}
        
        # Date filtering
        if date_from or date_to:
            date_query = {}
            if date_from:
                try:
                    from_date = datetime.strptime(date_from, '%Y-%m-%d')
                    date_query['$gte'] = from_date
                except Exception as e:
                    print(f"   Error parsing from_date: {e}")
            
            if date_to:
                try:
                    to_date = datetime.strptime(date_to, '%Y-%m-%d')
                    to_date = datetime(to_date.year, to_date.month, to_date.day, 23, 59, 59)
                    date_query['$lte'] = to_date
                except Exception as e:
                    print(f"   Error parsing to_date: {e}")
            
            if date_query:
                query['timestamp'] = date_query
        
        # Thana filtering
        if selected_thana and selected_thana != 'all':
            query['station_name'] = selected_thana
        
        print(f"   MongoDB Query: {query}")
        
        # Fetch feedbacks
        feedbacks = list(feedback_collection.find(query))
        print(f"   Found {len(feedbacks)} feedbacks matching criteria")
        
        # Initialize report structure
        report = {
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'total_feedbacks': len(feedbacks),
                'date_range': {'from': date_from, 'to': date_to}
            },
            'thana_analysis': {},
            'reason_analysis': {},
            'frequency_analysis': {},
            'response_time_analysis': {},
            'monthly_trends': {},
            'overall_ratings': {
                'average_rating': 0,
                'rating_distribution': {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
            },
            'recommendations': []
        }
        
        if len(feedbacks) == 0:
            print("⚠️ No feedbacks found for selected criteria")
            return jsonify({'success': True, 'report': report})
        
        # Process data
        total_rating = 0
        rating_count = 0
        thana_data = {}
        reason_data = {}
        frequency_data = {}
        monthly_data = {}
        
        for fb in feedbacks:
            # Get rating (your schema uses 'experience_rating')
            rating = fb.get('experience_rating', 0)
            if rating:
                if isinstance(rating, str):
                    rating = int(rating)
                total_rating += rating
                rating_count += 1
                if rating in report['overall_ratings']['rating_distribution']:
                    report['overall_ratings']['rating_distribution'][rating] += 1
            
            # Thana analysis (your schema uses 'station_name')
            thana = fb.get('station_name', 'Unknown')
            if thana not in thana_data:
                thana_data[thana] = {
                    'total': 0, 
                    'ratings': [], 
                    'positive': 0, 
                    'negative': 0, 
                    'neutral': 0
                }
            thana_data[thana]['total'] += 1
            thana_data[thana]['ratings'].append(rating)
            
            if rating >= 4:
                thana_data[thana]['positive'] += 1
            elif rating <= 2:
                thana_data[thana]['negative'] += 1
            else:
                thana_data[thana]['neutral'] += 1
            
            # Reason analysis (your schema uses 'reason')
            reason = fb.get('reason', 'Other')
            if reason not in reason_data:
                reason_data[reason] = {'count': 0, 'ratings': []}
            reason_data[reason]['count'] += 1
            reason_data[reason]['ratings'].append(rating)
            
            # Frequency analysis (your schema uses 'frequency')
            frequency = fb.get('frequency', 'First time')
            if frequency not in frequency_data:
                frequency_data[frequency] = {'count': 0, 'ratings': []}
            frequency_data[frequency]['count'] += 1
            frequency_data[frequency]['ratings'].append(rating)
            
            # Monthly trends (your schema uses 'timestamp')
            if fb.get('timestamp'):
                try:
                    ts = fb['timestamp']
                    if isinstance(ts, str):
                        ts = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    month_key = ts.strftime('%Y-%m')
                    if month_key not in monthly_data:
                        monthly_data[month_key] = {'count': 0, 'total_rating': 0}
                    monthly_data[month_key]['count'] += 1
                    monthly_data[month_key]['total_rating'] += rating
                except Exception as e:
                    print(f"   Date parsing error: {e}")
        
        # Calculate averages for thana analysis
        for thana, data in thana_data.items():
            if data['ratings']:
                avg_rating = sum(data['ratings']) / len(data['ratings'])
                satisfaction_rate = (data['positive'] / data['total']) * 100 if data['total'] > 0 else 0
                report['thana_analysis'][thana] = {
                    'total_feedbacks': data['total'],
                    'average_rating': round(avg_rating, 2),
                    'satisfaction_rate': round(satisfaction_rate, 2),
                    'positive': data['positive'],
                    'neutral': data['neutral'],
                    'negative': data['negative']
                }
        
        # Calculate averages for reason analysis
        for reason, data in reason_data.items():
            if data['ratings']:
                avg_rating = sum(data['ratings']) / len(data['ratings'])
                report['reason_analysis'][reason] = {
                    'count': data['count'],
                    'average_rating': round(avg_rating, 2)
                }
        
        # Calculate averages for frequency analysis
        for freq, data in frequency_data.items():
            if data['ratings']:
                avg_rating = sum(data['ratings']) / len(data['ratings'])
                report['frequency_analysis'][freq] = {
                    'count': data['count'],
                    'average_rating': round(avg_rating, 2)
                }
        
        # Monthly trends
        for month in sorted(monthly_data.keys()):
            data = monthly_data[month]
            if data['count'] > 0:
                report['monthly_trends'][month] = {
                    'total_feedbacks': data['count'],
                    'average_rating': round(data['total_rating'] / data['count'], 2)
                }
        
        # Overall average rating
        if rating_count > 0:
            report['overall_ratings']['average_rating'] = round(total_rating / rating_count, 2)
        
        # Generate recommendations
        recommendations = []
        
        # Find low performing thanas
        low_thanas = []
        for thana, data in report['thana_analysis'].items():
            if data['average_rating'] < 3.0 and data['total_feedbacks'] >= 1:
                low_thanas.append((thana, data['average_rating']))
        
        if low_thanas:
            low_thanas.sort(key=lambda x: x[1])
            recommendations.append({
                'type': 'critical',
                'title': 'थानों में सुधार की आवश्यकता',
                'description': f'इन थानों में सेवा स्तर सुधारने की आवश्यकता है: {", ".join([t[0] for t in low_thanas[:3]])}',
                'action_items': [
                    'कर्मियों के लिए ग्राहक सेवा प्रशिक्षण',
                    'शिकायत निवारण प्रक्रिया में तेजी लाएं',
                    'नियमित फीडबैक समीक्षा बैठकें आयोजित करें'
                ]
            })
        
        report['recommendations'] = recommendations
        
        print(f"✅ Report generated successfully with {len(feedbacks)} records")
        print(f"   Thanas analyzed: {len(report['thana_analysis'])}")
        print(f"   Average rating: {report['overall_ratings']['average_rating']}/5")
        
        return jsonify({'success': True, 'report': report})
        
    except Exception as e:
        print(f"❌ Error generating report: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    print("\n" + "=" * 60)
    print("🐍 Python Report Service Running")
    print("=" * 60)
    print("📊 Health: http://localhost:5001/api/health")
    print("🔍 Debug: http://localhost:5001/api/debug/feedbacks")
    print("📈 Report: http://localhost:5001/api/reports/thana-analysis")
    print("=" * 60 + "\n")
    
    # Run the server
    app.run(debug=False, port=5001, host='0.0.0.0', threaded=True)